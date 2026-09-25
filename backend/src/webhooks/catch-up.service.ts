import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { GithubService } from '../github/github.service.js';
import type { GithubHookDelivery } from '../github/github.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
    private readonly prisma: PrismaService,
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
      this.logger.error(`Catch-up failed: ${(err as Error).message}`);
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
    const stored = await this.prisma.webhookDelivery.findMany({
      where: { id: { in: failed.map((a) => a.guid) } },
      select: { id: true },
    });
    const storedIds = new Set(stored.map((s) => s.id));
    return failed.filter((a) => !storedIds.has(a.guid));
  }
}
