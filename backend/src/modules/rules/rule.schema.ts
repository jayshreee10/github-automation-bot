import { z } from 'zod';
import { REPO_EVENTS } from '../events/repo-event.js';

const MAX_LIST = 20;

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const list = (item: z.ZodString) => z.array(item).max(MAX_LIST).default([]);
const login = z.string().regex(/^[A-Za-z0-9-]{1,39}(\[bot\])?$/);

// match "all": every non-empty keyword/author/label list must hold; "any": one is enough. Inside a list any value is enough.
export const ruleConditionsSchema = z.object({
  // Webhook actions such as "opened"; the matcher defaults to ["opened"] for issues and PRs. Unused for push.
  actions: z
    .array(z.string().regex(/^[a-z_]{1,40}$/))
    .min(1)
    .max(MAX_LIST)
    .optional(),
  match: z.enum(['all', 'any']).default('all'),
  titleContains: list(trimmed(100)),
  bodyContains: list(trimmed(100)),
  authors: list(login),
  // Always a hard filter, whatever `match` says.
  excludeAuthors: list(login),
  labels: list(trimmed(50)),
  // Push only: branch names without the refs/heads/ prefix.
  branches: list(trimmed(255)),
});

// Placeholders in comment bodies are limited to {author}, {title} and {url}.
export const ruleActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_label'),
    labels: z.array(trimmed(50)).min(1).max(10),
  }),
  z.object({ type: z.literal('add_comment'), body: trimmed(2000) }),
  z.object({ type: z.literal('slack_notify') }),
]);

export const ruleEventSchema = z.enum(REPO_EVENTS);

// Fields shared by create, update and the stored rule; compatibility checks live in ruleDefinitionSchema.
const ruleFields = z.object({
  name: trimmed(100),
  event: ruleEventSchema,
  conditions: ruleConditionsSchema.default({
    match: 'all',
    titleContains: [],
    bodyContains: [],
    authors: [],
    excludeAuthors: [],
    labels: [],
    branches: [],
  }),
  actions: z.array(ruleActionSchema).min(1).max(3),
  enabled: z.boolean().default(true),
});

type RuleFields = z.infer<typeof ruleFields>;

// Push has nothing to label or comment on; the unique key (delivery, rule, type) allows one action per type.
function checkCompatible(rule: RuleFields, ctx: z.RefinementCtx): void {
  const types = rule.actions.map((a) => a.type);
  if (new Set(types).size !== types.length)
    ctx.addIssue({
      code: 'custom',
      path: ['actions'],
      message: 'at most one action of each type',
    });
  if (rule.event === 'push') {
    if (types.some((t) => t !== 'slack_notify'))
      ctx.addIssue({
        code: 'custom',
        path: ['actions'],
        message: 'push rules only support slack_notify',
      });
    if (rule.conditions.actions)
      ctx.addIssue({
        code: 'custom',
        path: ['conditions', 'actions'],
        message: 'push events have no action',
      });
    if (rule.conditions.labels.length)
      ctx.addIssue({
        code: 'custom',
        path: ['conditions', 'labels'],
        message: 'push events have no labels',
      });
  } else if (rule.conditions.branches.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['conditions', 'branches'],
      message: 'branches apply to push rules only',
    });
  }
}

export const ruleDefinitionSchema = ruleFields.superRefine(checkCompatible);

export const createRuleSchema = ruleFields
  .extend({ repositoryId: z.string().regex(/^\d{1,20}$/) })
  .superRefine(checkCompatible);

// Partial fields; the service merges them onto the stored rule and re-checks with ruleDefinitionSchema.
export const updateRuleSchema = z
  .object({
    name: ruleFields.shape.name,
    event: ruleFields.shape.event,
    conditions: ruleConditionsSchema,
    actions: ruleFields.shape.actions,
    enabled: z.boolean(),
  })
  .partial();

// firedCount: deliveries the rule acted on (any action row), all time.
export const ruleSchema = ruleFields.extend({
  id: z.uuid(),
  repositoryId: z.string(),
  firedCount: z.number(),
  lastFiredAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ruleListQuerySchema = z.object({
  repositoryId: z
    .string()
    .regex(/^\d{1,20}$/)
    .optional(),
});

export const ruleIdParamSchema = z.uuid();

export type RuleConditions = z.infer<typeof ruleConditionsSchema>;
export type RuleAction = z.infer<typeof ruleActionSchema>;
export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;
export type CreateRuleBody = z.infer<typeof createRuleSchema>;
export type UpdateRuleBody = z.infer<typeof updateRuleSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type RuleListQuery = z.infer<typeof ruleListQuerySchema>;
