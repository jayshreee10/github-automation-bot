import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import type { ActionType, Prisma } from '../../generated/prisma/client.js';

export interface ActionKey {
  deliveryId: string;
  ruleId: string;
  type: ActionType;
}

// All SQL for the actions log. One row per (delivery, rule, type) is the idempotency key.
@Injectable()
export class ActionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Insert-if-absent then read, so concurrent or repeated runs all see the same row.
  async ensure(key: ActionKey) {
    await this.prisma.action.createMany({ data: [key], skipDuplicates: true });
    return this.prisma.action.findUniqueOrThrow({
      where: { deliveryId_ruleId_type: key },
    });
  }

  // Counted before the side effect, so a crash mid-action still shows the next run it is a retry.
  async begin(id: string): Promise<void> {
    await this.prisma.action.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async succeed(
    id: string,
    result: Prisma.InputJsonValue,
    durationMs: number,
  ): Promise<void> {
    await this.prisma.action.update({
      where: { id },
      data: {
        status: 'succeeded',
        result,
        error: null,
        durationMs,
      },
    });
  }

  // Transient failures stay pending for the next job attempt; permanent ones become failed.
  async fail(
    id: string,
    error: string,
    permanent: boolean,
    durationMs: number,
  ): Promise<void> {
    await this.prisma.action.update({
      where: { id },
      data: {
        status: permanent ? 'failed' : 'pending',
        error,
        durationMs,
      },
    });
  }

  async installationIdFor(repositoryId: bigint): Promise<number | null> {
    const row = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { installationId: true },
    });
    return row ? Number(row.installationId) : null;
  }
}
