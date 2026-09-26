import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';

export interface NewDelivery {
  id: string;
  event: string;
  action: string | null;
  repositoryId: bigint | null;
  rawJson: string;
}

@Injectable()
export class WebhookDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // One statement, so delivery and job commit together. A known delivery id inserts nothing (returns false).
  // repository_id is linked only when we already track that repo; payload ids never create rows.
  async insertWithJob(d: NewDelivery): Promise<boolean> {
    const inserted = await this.prisma.$executeRaw`
      WITH d AS (
        INSERT INTO webhook_deliveries (id, event, action, repository_id, payload)
        VALUES (
          ${d.id}, ${d.event}, ${d.action},
          (SELECT id FROM repositories WHERE id = ${d.repositoryId}::bigint),
          ${d.rawJson}::jsonb)
        ON CONFLICT (id) DO NOTHING
        RETURNING id)
      INSERT INTO jobs (id, delivery_id, updated_at)
      SELECT gen_random_uuid(), id, now() FROM d`;
    return inserted === 1;
  }

  // Which of these delivery ids are already stored.
  async findStoredIds(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.webhookDelivery.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  // Remembers a redelivery we asked for, so the dashboard can count recovered deliveries.
  async recordRedelivery(deliveryId: string): Promise<void> {
    await this.prisma.redeliveryRequest.upsert({
      where: { deliveryId },
      create: { deliveryId },
      update: {},
    });
  }

  async pruneRedeliveries(before: Date): Promise<void> {
    await this.prisma.redeliveryRequest.deleteMany({
      where: { requestedAt: { lt: before } },
    });
  }
}
