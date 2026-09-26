import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  SUMMARY_COLUMNS,
  type SummaryColumns,
} from '../events/event-summary.js';
import type { JobStatus } from '../events/events.types.js';

export type FailureRow = SummaryColumns & {
  jobId: string;
  deliveryId: string;
  event: string;
  action: string | null;
  repositoryId: bigint;
  repositoryName: string;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  nextRunAt: Date;
  updatedAt: Date;
};

// Postgres fragment: this job's delivery has at least one permanently failed action.
const HAS_FAILED_ACTION = Prisma.sql`EXISTS (
  SELECT 1 FROM actions a WHERE a.delivery_id = j.delivery_id AND a.status = 'failed')`;

// Scoped to the caller through repo → installation → user, like every dashboard query.
@Injectable()
export class FailuresRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(
    userId: string,
    repositoryId: bigint | undefined,
    take: number,
  ): Promise<FailureRow[]> {
    return this.prisma.$queryRaw<FailureRow[]>`
      SELECT j.id::text AS "jobId", j.delivery_id AS "deliveryId", d.event, d.action,
        r.id AS "repositoryId", r.full_name AS "repositoryName",
        ${SUMMARY_COLUMNS},
        j.status::text AS status, j.attempts, j.last_error AS "lastError",
        j.next_run_at AS "nextRunAt", j.updated_at AS "updatedAt"
      FROM jobs j
      JOIN webhook_deliveries d ON d.id = j.delivery_id
      JOIN repositories r ON r.id = d.repository_id
      JOIN installations i ON i.id = r.installation_id
      WHERE i.user_id = ${userId}
        ${repositoryId === undefined ? Prisma.empty : Prisma.sql`AND r.id = ${repositoryId}`}
        AND (j.status IN ('failed', 'dead') OR ${HAS_FAILED_ACTION})
      ORDER BY j.updated_at DESC
      LIMIT ${take}`;
  }

  actionsFor(deliveryIds: string[]) {
    return this.prisma.action.findMany({
      where: { deliveryId: { in: deliveryIds } },
      include: { rule: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // One conditional UPDATE: only an owned job that is failed, dead, or done with failed actions is reset,
  // so a double click or a job the worker already holds matches nothing. Failed actions go back to pending
  // in the same transaction; succeeded ones stay, so the rerun skips them.
  retry(userId: string, jobId: string): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ deliveryId: string }[]>`
        UPDATE jobs j SET
          status = 'pending', attempts = 0, next_run_at = now(), locked_at = NULL, updated_at = now()
        FROM webhook_deliveries d
        JOIN repositories r ON r.id = d.repository_id
        JOIN installations i ON i.id = r.installation_id
        WHERE j.id = ${jobId}::uuid AND d.id = j.delivery_id AND i.user_id = ${userId}
          AND (j.status IN ('failed', 'dead') OR (j.status = 'succeeded' AND ${HAS_FAILED_ACTION}))
        RETURNING j.delivery_id AS "deliveryId"`;
      const deliveryId = rows[0]?.deliveryId ?? null;
      if (deliveryId)
        await tx.action.updateMany({
          where: { deliveryId, status: 'failed' },
          data: { status: 'pending' },
        });
      return deliveryId;
    });
  }

  // Tells 404 (unknown or not the caller's) from 409 (owned but not retryable) after a retry matched nothing.
  async ownedJobStatus(
    userId: string,
    jobId: string,
  ): Promise<JobStatus | null> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        delivery: { repository: { installation: { userId } } },
      },
      select: { status: true },
    });
    return job?.status ?? null;
  }
}
