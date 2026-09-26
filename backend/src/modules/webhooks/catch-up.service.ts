import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { errorMessage } from '../../core/errors/error-message.js';
import { GithubService } from '../github/github.service.js';
import type { GithubHookDelivery } from '../github/github.types.js';
import { WebhookDeliveryRepository } from './webhook-delivery.repository.js';

const INTERVAL_MS = 15 * 60_000;
const LOOKBACK_MS = 3 * 24 * 60 * 60_000;
const MAX_REDELIVERIES_PER_RUN = 10;

// Recovers deliveries GitHub could not hand us (downtime, 5xx): on boot and every 15 min,
// finds guids we never stored whose latest attempt failed, and asks GitHub to redeliver them.
@Injectable()
export class CatchUpService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatchUpService.name);
  private running = false;

  constructor(
    private readonly github: GithubService,
    private readonly deliveries: WebhookDeliveryRepository,
  ) {}

  onApplicationBootstrap(): void {
    // Not awaited: boot must not wait on GitHub.
    void this.run();
  }

  @Interval(INTERVAL_MS)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const failed = await this.findMissedFailures();
      const batch = failed.slice(0, MAX_REDELIVERIES_PER_RUN);
      for (const d of batch) await this.github.redeliver(d.id);
      this.logger.log(
        `Catch-up: ${failed.length} missed deliveries, ${batch.length} redelivery requested`,
      );
    } catch (err) {
      this.logger.error(`Catch-up failed: ${errorMessage(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async findMissedFailures(): Promise<GithubHookDelivery[]> {
    const attempts = await this.github.listHookDeliveries(
      new Date(Date.now() - LOOKBACK_MS),
    );
    // Newest first, so the first attempt seen per guid is its latest.
    const latest = new Map<string, GithubHookDelivery>();
    for (const a of attempts) if (!latest.has(a.guid)) latest.set(a.guid, a);

    const failed = [...latest.values()].filter(
      (a) => a.status_code < 200 || a.status_code >= 300,
    );
    if (failed.length === 0) return [];
    const storedIds = await this.deliveries.findStoredIds(
      failed.map((a) => a.guid),
    );
    return failed.filter((a) => !storedIds.has(a.guid));
  }
}
