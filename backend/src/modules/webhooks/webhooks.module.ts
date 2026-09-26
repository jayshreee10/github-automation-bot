import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { CatchUpService } from './catch-up.service.js';
import { WebhookDeliveryRepository } from './webhook-delivery.repository.js';
import { WebhookSignatureGuard } from './webhook-signature.guard.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [GithubModule, QueueModule],
  controllers: [WebhooksController],
  providers: [
    WebhookDeliveryRepository,
    WebhooksService,
    WebhookSignatureGuard,
    CatchUpService,
  ],
})
export class WebhooksModule {}
