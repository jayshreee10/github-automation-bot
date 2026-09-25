import {
  type BeforeApplicationShutdown,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '../config/config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HandlerRegistry } from './handler.registry.js';
import { PermanentJobError } from './job-errors.js';
import { type ClaimedJob, JobRepository } from './job-repository.js';
import {
  BATCH_SIZE,
  MAX_ATTEMPTS,
  POLL_INTERVAL_MS,
} from './queue.constants.js';

// In-process worker. One batch at a time; on shutdown it stops claiming and waits for the batch in flight.
@Injectable()
export class WorkerService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(WorkerService.name);
  private inFlight: Promise<void> | null = null;
  private stopping = false;

  constructor(
    private readonly jobs: JobRepository,
    private readonly registry: HandlerRegistry,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  poll(): void {
    if (this.stopping || this.inFlight) return;
    this.inFlight = this.runBatch()
      .catch((err: Error) =>
        this.logger.error(`Worker poll failed: ${err.message}`),
      )
      .finally(() => {
        this.inFlight = null;
      });
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    await this.inFlight;
  }

  private async runBatch(): Promise<void> {
    const claimed = await this.jobs.claim(BATCH_SIZE);
    await Promise.all(claimed.map((job) => this.run(job)));
  }

  private async run(job: ClaimedJob): Promise<void> {
    const tag = `Job ${job.id} delivery ${job.deliveryId} attempt ${job.attempts}`;
    try {
      // Only reachable by reclaiming after crashes; stop a job that keeps killing the process.
      if (job.attempts > MAX_ATTEMPTS)
        throw new PermanentJobError('attempts exhausted by crashes');
      const delivery = await this.prisma.webhookDelivery.findUnique({
        where: { id: job.deliveryId },
      });
      if (!delivery) throw new PermanentJobError('delivery missing');
      const handler = this.registry.get(delivery.event);
      if (!handler)
        throw new PermanentJobError(`no handler for ${delivery.event}`);
      this.maybeForceFailure(delivery.event);

      await handler.handle(delivery);
      await this.jobs.succeed(job);
      this.logger.log(`${tag} ${delivery.event}: succeeded`);
    } catch (err) {
      const outcome = await this.jobs.fail(job, err);
      const log = outcome === 'dead' ? 'error' : 'warn';
      this.logger[log](`${tag}: ${outcome} (${(err as Error).message})`);
    }
  }

  // Dev-only hook for testing retries and dead-lettering (QUEUE_FAIL_EVENT). No effect in production.
  private maybeForceFailure(event: string): void {
    if (
      this.config.get('NODE_ENV') !== 'production' &&
      this.config.get('QUEUE_FAIL_EVENT') === event
    )
      throw new Error('forced failure (QUEUE_FAIL_EVENT)');
  }
}
