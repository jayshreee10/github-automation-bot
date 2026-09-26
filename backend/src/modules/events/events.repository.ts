import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { Cursor } from './cursor.js';
import {
  SUMMARY_COLUMNS,
  SUMMARY_TITLE,
  type SummaryColumns,
} from './event-summary.js';
import type { JobStatus } from './events.types.js';

export interface EventFilter {
  repositoryId?: bigint;
  event?: string;
  status?: JobStatus;
  q?: string;
  before?: Cursor;
}

export type EventRow = SummaryColumns & {
  id: string;
  event: string;
  action: string | null;
  repositoryId: bigint;
  repositoryName: string;
  receivedAt: Date;
  jobId: string | null;
  jobStatus: JobStatus | null;
  jobAttempts: number | null;
  jobNextRunAt: Date | null;
  jobLastError: string | null;
  jobUpdatedAt: Date | null;
};

export interface StatsRow {
  events: number;
  eventsPrevious: number;
  actionsSucceeded: number;
  actionsFailed: number;
  labelsAdded: number;
  commentsPosted: number;
  slackSent: number;
  jobsDead: number;
  jobsPending: number;
  jobsRetrying: number;
  jobsDeadTotal: number;
  jobsSucceeded: number;
  recoveredDeliveries: number;
  lastDeliveryAt: Date | null;
}

const optional = (condition: unknown, fragment: Prisma.Sql) =>
  condition === undefined ? Prisma.empty : fragment;

// LIKE wildcards in user input are matched literally (backslash is Postgres's default escape).
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

// Filters shared by the page query and its count; the cursor is not part of them.
function filterSql(f: EventFilter): Prisma.Sql {
  const contains = f.q === undefined ? '' : `%${escapeLike(f.q)}%`;
  const prefix = f.q === undefined ? '' : `${escapeLike(f.q)}%`;
  return Prisma.sql`
    ${optional(f.repositoryId, Prisma.sql`AND d.repository_id = ${f.repositoryId}`)}
    ${optional(f.event, Prisma.sql`AND d.event = ${f.event}`)}
    ${optional(f.status, Prisma.sql`AND j.status::text = ${f.status}`)}
    ${optional(
      f.q,
      Prisma.sql`AND (${SUMMARY_TITLE} ILIKE ${contains}
        OR d.payload->'sender'->>'login' ILIKE ${contains} OR d.id ILIKE ${prefix})`,
    )}`;
}

// All dashboard SQL for deliveries. Every query goes repo → installation → user, so other users' rows never match.
// Deliveries without a repository (installation events) are left out by the inner join.
@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Keyset paging on (received_at, id); the cursor time is cast from ISO text, so no JS time zone conversion.
  list(userId: string, f: EventFilter, take: number): Promise<EventRow[]> {
    return this.select(
      userId,
      Prisma.sql`
        ${filterSql(f)}
        ${optional(
          f.before,
          Prisma.sql`AND (d.received_at, d.id) <
            (${f.before?.receivedAt.toISOString()}::timestamptz AT TIME ZONE 'UTC', ${f.before?.id})`,
        )}`,
      take,
    );
  }

  async count(userId: string, f: EventFilter): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      FROM webhook_deliveries d
      JOIN repositories r ON r.id = d.repository_id
      JOIN installations i ON i.id = r.installation_id
      LEFT JOIN jobs j ON j.delivery_id = d.id
      WHERE i.user_id = ${userId} ${filterSql(f)}`;
    return row.total;
  }

  async findForUser(userId: string, id: string): Promise<EventRow | null> {
    const rows = await this.select(userId, Prisma.sql`AND d.id = ${id}`, 1);
    return rows[0] ?? null;
  }

  actionsFor(deliveryIds: string[]) {
    return this.prisma.action.findMany({
      where: { deliveryId: { in: deliveryIds } },
      select: {
        deliveryId: true,
        type: true,
        status: true,
        rule: { select: { actions: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  actionDetails(deliveryId: string) {
    return this.prisma.action.findMany({
      where: { deliveryId },
      include: {
        rule: { select: { name: true, event: true, conditions: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Last 24 hours (previous 24 for eventsPrevious). Actions and jobs count by when they last changed.
  // Pending, retrying and total dead jobs are current state; lastDeliveryAt is all-time.
  // recoveredDeliveries: arrived after the catch-up job asked GitHub to redeliver them.
  async stats(userId: string, repositoryId?: bigint): Promise<StatsRow> {
    const [row] = await this.prisma.$queryRaw<StatsRow[]>`
      WITH owned AS (
        SELECT r.id FROM repositories r
        JOIN installations i ON i.id = r.installation_id
        WHERE i.user_id = ${userId}
          ${optional(repositoryId, Prisma.sql`AND r.id = ${repositoryId}`)}
      ), deliveries AS (
        SELECT d.id, d.received_at FROM webhook_deliveries d
        WHERE d.repository_id IN (SELECT id FROM owned)
      ), acts AS (
        SELECT a.type::text AS type, a.status::text AS status FROM actions a
        JOIN deliveries d ON d.id = a.delivery_id
        WHERE a.updated_at >= now() - interval '24 hours'
      ), js AS (
        SELECT j.status::text AS status, j.updated_at >= now() - interval '24 hours' AS recent
        FROM jobs j JOIN deliveries d ON d.id = j.delivery_id
      )
      SELECT
        (SELECT count(*)::int FROM deliveries
          WHERE received_at >= now() - interval '24 hours') AS events,
        (SELECT count(*)::int FROM deliveries
          WHERE received_at >= now() - interval '48 hours'
            AND received_at < now() - interval '24 hours') AS "eventsPrevious",
        (SELECT count(*)::int FROM acts WHERE status = 'succeeded') AS "actionsSucceeded",
        (SELECT count(*)::int FROM acts WHERE status = 'failed') AS "actionsFailed",
        (SELECT count(*)::int FROM acts WHERE status = 'succeeded' AND type = 'add_label') AS "labelsAdded",
        (SELECT count(*)::int FROM acts WHERE status = 'succeeded' AND type = 'add_comment') AS "commentsPosted",
        (SELECT count(*)::int FROM acts WHERE status = 'succeeded' AND type = 'slack_notify') AS "slackSent",
        (SELECT count(*)::int FROM js WHERE status = 'dead' AND recent) AS "jobsDead",
        (SELECT count(*)::int FROM js WHERE status IN ('pending', 'running')) AS "jobsPending",
        (SELECT count(*)::int FROM js WHERE status = 'failed') AS "jobsRetrying",
        (SELECT count(*)::int FROM js WHERE status = 'dead') AS "jobsDeadTotal",
        (SELECT count(*)::int FROM js WHERE status = 'succeeded' AND recent) AS "jobsSucceeded",
        (SELECT count(*)::int FROM deliveries d JOIN redelivery_requests q ON q.delivery_id = d.id
          WHERE d.received_at >= now() - interval '24 hours') AS "recoveredDeliveries",
        (SELECT max(received_at) FROM deliveries) AS "lastDeliveryAt"`;
    return row;
  }

  private select(
    userId: string,
    where: Prisma.Sql,
    take: number,
  ): Promise<EventRow[]> {
    return this.prisma.$queryRaw<EventRow[]>`
      SELECT d.id, d.event, d.action, d.received_at AS "receivedAt",
        r.id AS "repositoryId", r.full_name AS "repositoryName",
        ${SUMMARY_COLUMNS},
        j.id::text AS "jobId", j.status::text AS "jobStatus", j.attempts AS "jobAttempts",
        j.next_run_at AS "jobNextRunAt", j.last_error AS "jobLastError", j.updated_at AS "jobUpdatedAt"
      FROM webhook_deliveries d
      JOIN repositories r ON r.id = d.repository_id
      JOIN installations i ON i.id = r.installation_id
      LEFT JOIN jobs j ON j.delivery_id = d.id
      WHERE i.user_id = ${userId} ${where}
      ORDER BY d.received_at DESC, d.id DESC
      LIMIT ${take}`;
  }
}
