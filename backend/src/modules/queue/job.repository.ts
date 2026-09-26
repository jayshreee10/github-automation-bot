import { Injectable } from '@nestjs/common';
import { redact } from '../../core/logger/redact.js';
import type { WebhookDelivery } from '../../generated/prisma/client.js';
import { PrismaService } from '../../core/database/prisma.service.js';
import { PermanentJobError } from './job-errors.js';
import {
  backoffMs,
  LAST_ERROR_MAX,
  MAX_ATTEMPTS,
  STALE_LOCK_MS,
} from './queue.constants.js';

export interface ClaimedJob {
  id: string;
  deliveryId: string;
  attempts: number;
  lockedAt: Date;
}

export type FailOutcome = 'failed' | 'dead';

@Injectable()
export class JobRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Short transaction: mark due jobs running and commit. SKIP LOCKED lets concurrent workers take disjoint rows.
  // Stale running jobs (crashed process) are due too. attempts counts claims, so a crash loop still ends dead.
  async claim(limit: number): Promise<ClaimedJob[]> {
    // Computed in SQL: now() and the timestamp columns share the DB clock, so no JS time zone conversion.
    const staleSecs = STALE_LOCK_MS / 1000;
    return this.prisma.$queryRaw<ClaimedJob[]>`
      UPDATE jobs SET
        status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
      WHERE id IN (
        SELECT id FROM jobs
        WHERE (status IN ('pending', 'failed') AND next_run_at <= now())
           OR (status = 'running' AND locked_at < now() - make_interval(secs => ${staleSecs}::int))
        ORDER BY next_run_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED)
      RETURNING id, delivery_id AS "deliveryId", attempts, locked_at AS "lockedAt"`;
  }

  findDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.prisma.webhookDelivery.findUnique({ where: { id } });
  }

  // Updates are fenced on locked_at: if the lock went stale and another worker reclaimed the job, this is a no-op.
  async succeed(job: ClaimedJob): Promise<void> {
    await this.prisma.job.updateMany({
      where: { id: job.id, status: 'running', lockedAt: job.lockedAt },
      data: { status: 'succeeded', lockedAt: null, lastError: null },
    });
  }

  async fail(job: ClaimedJob, err: unknown): Promise<FailOutcome> {
    const dead =
      err instanceof PermanentJobError || job.attempts >= MAX_ATTEMPTS;
    await this.prisma.job.updateMany({
      where: { id: job.id, status: 'running', lockedAt: job.lockedAt },
      data: {
        status: dead ? 'dead' : 'failed',
        lockedAt: null,
        lastError: errorText(err),
        ...(dead
          ? {}
          : { nextRunAt: new Date(Date.now() + backoffMs(job.attempts)) }),
      },
    });
    return dead ? 'dead' : 'failed';
  }
}

// Stored for the failures view: name + message only, redacted and truncated. No stack, no payload.
function errorText(err: unknown): string {
  const text =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return (redact(text) as string).slice(0, LAST_ERROR_MAX);
}
