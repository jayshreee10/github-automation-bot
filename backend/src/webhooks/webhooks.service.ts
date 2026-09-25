import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  HANDLED_EVENTS,
  type IngestResult,
  webhookEnvelopeSchema,
  type WebhookHeaders,
} from './webhook.types.js';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  // Stores the delivery and its job atomically. The raw body is stored as-is, never re-serialised.
  async ingest(
    headers: WebhookHeaders,
    body: unknown,
    rawBody: Buffer,
  ): Promise<IngestResult> {
    const event = headers['x-github-event'];
    if (event === 'ping') return 'ping';
    if (!HANDLED_EVENTS.has(event)) return 'ignored';

    const envelope = webhookEnvelopeSchema.safeParse(body);
    if (!envelope.success) throw new BadRequestException();
    const { action, repository } = envelope.data;
    const repoId = repository ? BigInt(repository.id) : null;

    // One statement, so delivery and job commit together. A known delivery id inserts nothing (duplicate).
    // repository_id is linked only when we already track that repo; payload ids never create rows.
    const inserted = await this.prisma.$executeRaw`
      WITH d AS (
        INSERT INTO webhook_deliveries (id, event, action, repository_id, payload)
        VALUES (
          ${headers['x-github-delivery']}, ${event}, ${action ?? null},
          (SELECT id FROM repositories WHERE id = ${repoId}::bigint),
          ${rawBody.toString('utf8')}::jsonb)
        ON CONFLICT (id) DO NOTHING
        RETURNING id)
      INSERT INTO jobs (id, delivery_id, updated_at)
      SELECT gen_random_uuid(), id, now() FROM d`;
    return inserted === 1 ? 'accepted' : 'duplicate';
  }
}
