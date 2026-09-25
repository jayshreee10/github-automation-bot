import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { CatchUpService } from './catch-up.service.js';
import { WebhookSignatureGuard } from './webhook-signature.guard.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [GithubModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSignatureGuard, CatchUpService],
})
export class WebhooksModule {}
