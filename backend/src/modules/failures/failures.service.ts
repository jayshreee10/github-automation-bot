import { Injectable, Logger } from '@nestjs/common';
import { requestContext } from '../../core/context/request-context.js';
import {
  ConflictError,
  NotFoundError,
} from '../../core/errors/domain.error.js';
import { toEventSummary } from '../events/event-summary.js';
import { MAX_ATTEMPTS } from '../queue/queue.constants.js';
import type { FailureList } from './failures.types.js';
import { FailuresRepository } from './failures.repository.js';

const LIST_LIMIT = 100;

@Injectable()
export class FailuresService {
  private readonly logger = new Logger(FailuresService.name);

  constructor(private readonly failures: FailuresRepository) {}

  async list(userId: string, repositoryId?: string): Promise<FailureList> {
    const rows = await this.failures.list(
      userId,
      repositoryId === undefined ? undefined : BigInt(repositoryId),
      LIST_LIMIT,
    );
    const actions = rows.length
      ? await this.failures.actionsFor(rows.map((r) => r.deliveryId))
      : [];
    return {
      items: rows.map((r) => {
        const own = actions
          .filter((a) => a.deliveryId === r.deliveryId)
          .map((a) => ({
            id: a.id,
            type: a.type,
            ruleName: a.rule.name,
            status: a.status,
            attempts: a.attempts,
            error: a.error,
          }));
        return {
          jobId: r.jobId,
          deliveryId: r.deliveryId,
          event: r.event,
          action: r.action,
          repository: {
            id: r.repositoryId.toString(),
            fullName: r.repositoryName,
          },
          summary: toEventSummary(r),
          status: r.status,
          attempts: r.attempts,
          maxAttempts: MAX_ATTEMPTS,
          lastError: r.lastError,
          nextRunAt: r.nextRunAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          actions: own,
          retryable:
            r.status === 'failed' ||
            r.status === 'dead' ||
            (r.status === 'succeeded' &&
              own.some((a) => a.status === 'failed')),
        };
      }),
    };
  }

  // Queues the job to run now; the worker picks it up on its next poll.
  async retry(userId: string, jobId: string): Promise<void> {
    const deliveryId = await this.failures.retry(userId, jobId);
    if (deliveryId) {
      requestContext.set({ deliveryId, jobId });
      this.logger.log(
        `Job ${jobId} delivery ${deliveryId}: manual retry queued`,
      );
      return;
    }
    const status = await this.failures.ownedJobStatus(userId, jobId);
    if (status === null) throw new NotFoundError(`job ${jobId}`);
    throw new ConflictError(`job ${jobId} is ${status}`);
  }
}
