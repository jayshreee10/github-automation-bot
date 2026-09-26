import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { RuleDefinition } from './rule.schema.js';

// Ownership goes repo → installation → user, so a transferred installation takes its rules along.
const ownedBy = (userId: string): Prisma.RuleWhereInput => ({
  repository: { installation: { userId } },
});

export interface FiredStats {
  ruleId: string;
  firedCount: number;
  lastFiredAt: Date | null;
}

// Prisma's Json input type does not accept our zod types directly; they are plain JSON by construction.
const toJson = (value: unknown) => value as Prisma.InputJsonValue;

// All SQL for rules. Every user-facing query is scoped by the owner.
@Injectable()
export class RulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string, repositoryId?: bigint) {
    return this.prisma.rule.findMany({
      where: { ...ownedBy(userId), repositoryId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findForUser(id: string, userId: string) {
    return this.prisma.rule.findFirst({ where: { id, ...ownedBy(userId) } });
  }

  // Distinct deliveries per rule; uses the actions(rule_id, created_at) index.
  firedStats(ruleIds: string[]): Promise<FiredStats[]> {
    if (!ruleIds.length) return Promise.resolve([]);
    return this.prisma.$queryRaw<FiredStats[]>`
      SELECT rule_id::text AS "ruleId", count(DISTINCT delivery_id)::int AS "firedCount",
        max(created_at) AS "lastFiredAt"
      FROM actions WHERE rule_id = ANY(${ruleIds}::uuid[])
      GROUP BY rule_id`;
  }

  async repositoryOwnedBy(repositoryId: bigint, userId: string) {
    const row = await this.prisma.repository.findFirst({
      where: { id: repositoryId, installation: { userId } },
      select: { id: true },
    });
    return row !== null;
  }

  create(userId: string, repositoryId: bigint, rule: RuleDefinition) {
    return this.prisma.rule.create({
      data: {
        userId,
        repositoryId,
        ...rule,
        conditions: toJson(rule.conditions),
        actions: toJson(rule.actions),
      },
    });
  }

  update(id: string, rule: RuleDefinition) {
    return this.prisma.rule.update({
      where: { id },
      data: {
        ...rule,
        conditions: toJson(rule.conditions),
        actions: toJson(rule.actions),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.rule.delete({ where: { id } });
  }

  // For the event handler: no user scope, the delivery's repo already decides ownership.
  findActive(repositoryId: bigint, event: string) {
    return this.prisma.rule.findMany({
      where: { repositoryId, event, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
