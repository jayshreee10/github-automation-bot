import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import type { EventItem } from './events.types.js';

export type EventRow = Omit<EventItem, 'receivedAt'> & { receivedAt: Date };

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Only deliveries for repos in the user's installations. Title and link are read from the payload in SQL,
  // so the full payload never leaves the database.
  recentForUser(userId: string, limit: number): Promise<EventRow[]> {
    return this.prisma.$queryRaw<EventRow[]>`
      SELECT d.id, d.event, d.action, r.full_name AS repository,
        COALESCE(d.payload->'issue'->>'title', d.payload->'pull_request'->>'title',
                 split_part(d.payload->'head_commit'->>'message', E'\\n', 1)) AS title,
        COALESCE(d.payload->'issue'->>'html_url', d.payload->'pull_request'->>'html_url',
                 d.payload->>'compare') AS url,
        j.status::text AS status, COALESCE(j.attempts, 0) AS attempts,
        j.last_error AS "lastError", d.received_at AS "receivedAt"
      FROM webhook_deliveries d
      JOIN repositories r ON r.id = d.repository_id
      JOIN installations i ON i.id = r.installation_id
      LEFT JOIN jobs j ON j.delivery_id = d.id
      WHERE i.user_id = ${userId}
      ORDER BY d.received_at DESC
      LIMIT ${limit}`;
  }
}
