import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { AccessDeniedError } from '../../core/errors/domain.error.js';
import type { WebhookDelivery } from '../../generated/prisma/client.js';
import { HandlerRegistry } from '../queue/handler.registry.js';
import { PermanentJobError } from '../queue/job-errors.js';
import type { JobHandler } from '../queue/job-handler.js';
import { InstallationsService } from './installations.service.js';

const payloadSchema = z.object({
  action: z.string(),
  installation: z.object({ id: z.number().int().positive() }),
});

// Keeps installations and repos in sync without the user revisiting the setup URL.
// Only the installation id is read from the payload; repo lists are re-fetched from GitHub.
@Injectable()
export class InstallationEventsHandler implements JobHandler, OnModuleInit {
  readonly events = ['installation', 'installation_repositories'] as const;
  private readonly logger = new Logger(InstallationEventsHandler.name);

  constructor(
    private readonly registry: HandlerRegistry,
    private readonly installations: InstallationsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(delivery: WebhookDelivery): Promise<void> {
    const parsed = payloadSchema.safeParse(delivery.payload);
    if (!parsed.success)
      throw new PermanentJobError('unexpected payload shape');
    const { action, installation } = parsed.data;
    const tag = `Delivery ${delivery.id} ${delivery.event}.${action} installation ${installation.id}`;

    if (delivery.event === 'installation' && action === 'deleted') {
      const removed = await this.installations.removeKnown(installation.id);
      this.logger.log(`${tag}: ${removed ? 'removed' : 'unknown, no-op'}`);
      return;
    }
    // Suspend keeps rows (and the user's rules); GitHub calls fail until unsuspended. Created is linked by the setup flow.
    const resync =
      delivery.event === 'installation_repositories' ||
      action === 'unsuspend' ||
      action === 'new_permissions_accepted';
    if (!resync) {
      this.logger.log(`${tag}: no-op`);
      return;
    }
    try {
      const known = await this.installations.syncKnown(installation.id);
      this.logger.log(`${tag}: ${known ? 'repos synced' : 'unknown, no-op'}`);
    } catch (err) {
      // The account no longer matches the stored owner: retrying cannot fix that.
      if (err instanceof AccessDeniedError)
        throw new PermanentJobError('installation owner mismatch');
      throw err;
    }
  }
}
