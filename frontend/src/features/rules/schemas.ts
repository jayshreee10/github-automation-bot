import { z } from 'zod'

// Mirrors backend/src/modules/rules/rule.schema.ts so the form can show the same errors before saving.
export const RULE_EVENTS = ['issues', 'pull_request', 'push'] as const
const MAX_LIST = 20

const trimmed = (max: number) => z.string().trim().min(1).max(max)
const list = (item: z.ZodString) => z.array(item).max(MAX_LIST, `at most ${MAX_LIST} values`)

const login = z.string().regex(/^[A-Za-z0-9-]{1,39}(\[bot\])?$/, 'not a GitHub username')

// match "all": every filled condition must hold; "any": one is enough. excludeAuthors always applies.
export const ruleConditionsSchema = z.object({
  actions: z
    .array(z.string().regex(/^[a-z_]{1,40}$/, 'lowercase webhook actions like opened'))
    .min(1)
    .max(MAX_LIST)
    .optional(),
  match: z.enum(['all', 'any']),
  titleContains: list(trimmed(100)),
  bodyContains: list(trimmed(100)),
  authors: list(login),
  excludeAuthors: list(login),
  labels: list(trimmed(50)),
  branches: list(trimmed(255)),
})

export const ruleActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_label'), labels: z.array(trimmed(50)).min(1, 'add at least one label').max(10) }),
  z.object({ type: z.literal('add_comment'), body: z.string().trim().min(1, 'write a comment').max(2000) }),
  z.object({ type: z.literal('slack_notify') }),
])

export const ruleEventSchema = z.enum(RULE_EVENTS)

export const ruleInputSchema = z
  .object({
    name: z.string().trim().min(1, 'give the rule a name').max(100),
    event: ruleEventSchema,
    conditions: ruleConditionsSchema,
    actions: z.array(ruleActionSchema).min(1, 'choose at least one action').max(3),
    enabled: z.boolean(),
  })
  .superRefine((rule, ctx) => {
    if (rule.event !== 'push') return
    if (rule.actions.some((a) => a.type !== 'slack_notify'))
      ctx.addIssue({ code: 'custom', path: ['actions'], message: 'push rules only support Slack' })
  })

export const ruleSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  name: z.string(),
  event: ruleEventSchema,
  conditions: ruleConditionsSchema,
  actions: z.array(ruleActionSchema),
  enabled: z.boolean(),
  // Deliveries this rule acted on, all time.
  firedCount: z.number(),
  lastFiredAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type RuleEvent = z.infer<typeof ruleEventSchema>
export type RuleInput = z.infer<typeof ruleInputSchema>
export type Rule = z.infer<typeof ruleSchema>
export type RuleConditions = z.infer<typeof ruleConditionsSchema>
export type RuleAction = z.infer<typeof ruleActionSchema>
