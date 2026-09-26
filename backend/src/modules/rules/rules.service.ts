import { Injectable, Logger } from '@nestjs/common';
import {
  InvalidInputError,
  NotFoundError,
} from '../../core/errors/domain.error.js';
import type { Rule as RuleRow } from '../../generated/prisma/client.js';
import {
  type CreateRuleBody,
  type Rule,
  type RuleDefinition,
  ruleDefinitionSchema,
  type UpdateRuleBody,
} from './rule.schema.js';
import { type FiredStats, RulesRepository } from './rules.repository.js';

export type ActiveRule = RuleDefinition & { id: string };

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(private readonly rules: RulesRepository) {}

  async list(userId: string, repositoryId?: string): Promise<Rule[]> {
    const rows = await this.rules.listForUser(
      userId,
      repositoryId === undefined ? undefined : BigInt(repositoryId),
    );
    return this.withStats(rows);
  }

  async get(userId: string, id: string): Promise<Rule> {
    const row = await this.rules.findForUser(id, userId);
    if (!row) throw new NotFoundError(`rule ${id}`);
    const [rule] = await this.withStats([row]);
    return rule;
  }

  // The repo id comes from the client, so ownership is checked here; not owned looks the same as unknown.
  async create(userId: string, body: CreateRuleBody): Promise<Rule> {
    const repositoryId = BigInt(body.repositoryId);
    if (!(await this.rules.repositoryOwnedBy(repositoryId, userId)))
      throw new NotFoundError(`repository ${body.repositoryId}`);
    const { repositoryId: _, ...rule } = body;
    return toRule(await this.rules.create(userId, repositoryId, rule));
  }

  // Merged onto the stored rule and re-validated, so event ↔ action checks hold for partial updates too.
  async update(
    userId: string,
    id: string,
    body: UpdateRuleBody,
  ): Promise<Rule> {
    const row = await this.rules.findForUser(id, userId);
    if (!row) throw new NotFoundError(`rule ${id}`);
    const merged = ruleDefinitionSchema.safeParse({
      ...definition(row),
      ...body,
    });
    if (!merged.success)
      throw new InvalidInputError(merged.error.issues[0].message);
    const [rule] = await this.withStats([
      await this.rules.update(id, merged.data),
    ]);
    return rule;
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.rules.findForUser(id, userId);
    if (!row) throw new NotFoundError(`rule ${id}`);
    await this.rules.delete(id);
  }

  private async withStats(rows: RuleRow[]): Promise<Rule[]> {
    const stats = await this.rules.firedStats(rows.map((r) => r.id));
    const byId = new Map(stats.map((s) => [s.ruleId, s]));
    return rows.map((row) => toRule(row, byId.get(row.id)));
  }

  // Enabled rules for one repo and event. A stored rule that no longer parses is skipped, not fatal.
  async findActive(repositoryId: bigint, event: string): Promise<ActiveRule[]> {
    const rows = await this.rules.findActive(repositoryId, event);
    return rows.flatMap((row) => {
      const parsed = ruleDefinitionSchema.safeParse(definition(row));
      if (parsed.success) return [{ id: row.id, ...parsed.data }];
      this.logger.warn(`Rule ${row.id} is invalid, skipped`);
      return [];
    });
  }
}

function definition(row: RuleRow) {
  return {
    name: row.name,
    event: row.event,
    conditions: row.conditions,
    actions: row.actions,
    enabled: row.enabled,
  };
}

// A new rule has not fired yet, so stats are optional.
function toRule(row: RuleRow, stats?: FiredStats): Rule {
  const rule = ruleDefinitionSchema.parse(definition(row));
  return {
    id: row.id,
    repositoryId: row.repositoryId.toString(),
    ...rule,
    firedCount: stats?.firedCount ?? 0,
    lastFiredAt: stats?.lastFiredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
