import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { GithubService } from '../github/github.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EventItem, EventLog } from './events.types.js';

// The dashboard polls every few seconds; the App's webhook config rarely changes, so ask GitHub at most once a minute.
const HOOK_CONFIG_TTL_MS = 60_000;

type EventRow = Omit<EventItem, 'receivedAt'> & { receivedAt: Date };

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private hookCache?: { configured: boolean; at: number };

  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
  ) {}

  // Only deliveries for repos in the caller's installations. Title and link are read from the payload in SQL,
  // so the full payload never leaves the database.
  async list(user: AuthUser, limit: number): Promise<EventLog> {
    const [rows, configured] = await Promise.all([
      this.prisma.$queryRaw<EventRow[]>`
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
        WHERE i.user_id = ${user.id}
        ORDER BY d.received_at DESC
        LIMIT ${limit}`,
      this.hookConfigured(),
    ]);
    const events = rows.map((r) => ({
      ...r,
      receivedAt: r.receivedAt.toISOString(),
    }));
    return {
      webhook: { configured, lastDeliveryAt: events[0]?.receivedAt ?? null },
      events,
    };
  }

  private async hookConfigured(): Promise<boolean | null> {
    if (this.hookCache && Date.now() - this.hookCache.at < HOOK_CONFIG_TTL_MS)
      return this.hookCache.configured;
    try {
      const configured = await this.github.hookConfigured();
      this.hookCache = { configured, at: Date.now() };
      return configured;
    } catch (err) {
      this.logger.warn(
        `Webhook config check failed: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
