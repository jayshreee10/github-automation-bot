import { BadRequestException, Injectable } from '@nestjs/common';
import { HandlerRegistry } from '../queue/handler.registry.js';
import {
  type IngestResult,
  webhookEnvelopeSchema,
  type WebhookHeaders,
} from './webhook.types.js';
import { WebhookDeliveryRepository } from './webhook-delivery.repository.js';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly registry: HandlerRegistry,
  ) {}

  // Stores the delivery and its job atomically. The raw body is stored as-is, never re-serialised.
  // Only events with a registered job handler are stored; everything else is acknowledged and dropped.
  async ingest(
    headers: WebhookHeaders,
    body: unknown,
    rawBody: Buffer,
  ): Promise<IngestResult> {
    const event = headers['x-github-event'];
    if (event === 'ping') return 'ping';
    if (!this.registry.handles(event)) return 'ignored';

    const envelope = webhookEnvelopeSchema.safeParse(body);
    if (!envelope.success) throw new BadRequestException();
    const { action, repository } = envelope.data;

    const inserted = await this.deliveries.insertWithJob({
      id: headers['x-github-delivery'],
      event,
      action: action ?? null,
      repositoryId: repository ? BigInt(repository.id) : null,
      rawJson: rawBody.toString('utf8'),
    });
    return inserted ? 'accepted' : 'duplicate';
  }
}
