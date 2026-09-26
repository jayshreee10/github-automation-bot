import { Injectable, Logger } from '@nestjs/common';
import { errorMessage } from '../../core/errors/error-message.js';
import { GithubService } from '../github/github.service.js';
import { EventsRepository } from './events.repository.js';
import type { EventLog } from './events.types.js';

// The dashboard polls every few seconds; the App's webhook config rarely changes, so ask GitHub at most once a minute.
const HOOK_CONFIG_TTL_MS = 60_000;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private hookCache?: { configured: boolean; at: number };

  constructor(
    private readonly events: EventsRepository,
    private readonly github: GithubService,
  ) {}

  async list(userId: string, limit: number): Promise<EventLog> {
    const [rows, configured] = await Promise.all([
      this.events.recentForUser(userId, limit),
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
      this.logger.warn(`Webhook config check failed: ${errorMessage(err)}`);
      return null;
    }
  }
}
