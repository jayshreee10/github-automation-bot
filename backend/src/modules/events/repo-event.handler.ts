import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { WebhookDelivery } from '../../generated/prisma/client.js';
import { HandlerRegistry } from '../queue/handler.registry.js';
import type { JobHandler } from '../queue/job-handler.js';
import { REPO_EVENTS, toRepoEvent } from './repo-event.js';

// Normalises repo events. Phase 4 replaces the log line with rule matching and actions.
@Injectable()
export class RepoEventHandler implements JobHandler, OnModuleInit {
  readonly events = REPO_EVENTS;
  private readonly logger = new Logger(RepoEventHandler.name);

  constructor(private readonly registry: HandlerRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(delivery: WebhookDelivery): Promise<void> {
    // Installed but never connected through the setup flow: no owner, so nothing to act on.
    if (delivery.repositoryId === null) {
      this.logger.log(
        `Delivery ${delivery.id}: repository not connected, skipped`,
      );
      return;
    }
    const event = toRepoEvent(delivery.id, delivery.event, delivery.payload);
    this.logger.log(
      `Delivery ${delivery.id} ${event.event}${event.action ? `.${event.action}` : ''} on repo ${event.repository.id}: normalised`,
    );
  }
}
