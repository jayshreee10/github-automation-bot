import { z } from 'zod'
import { ruleConditionsSchema, ruleEventSchema } from '@/features/rules/schemas'

export const jobStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'dead'])
export const actionTypeSchema = z.enum(['add_label', 'add_comment', 'slack_notify', 'ai_triage'])
export const actionStatusSchema = z.enum(['pending', 'succeeded', 'failed', 'skipped'])

export const repositoryRefSchema = z.object({ id: z.string(), fullName: z.string() })

// Built by the API from a few payload fields; raw payloads are never sent.
export const eventSummarySchema = z.object({
  title: z.string().nullable(),
  number: z.number().nullable(),
  url: z.string().nullable(),
  author: z.string().nullable(),
  ref: z.string().nullable(),
})

// maxAttempts comes from the API so "2 / 5" never hard-codes the queue limit.
export const jobSummarySchema = z.object({
  id: z.string(),
  status: jobStatusSchema,
  attempts: z.number(),
  maxAttempts: z.number(),
})

export const eventItemSchema = z.object({
  id: z.string(),
  event: z.string(),
  action: z.string().nullable(),
  repository: repositoryRefSchema,
  summary: eventSummarySchema,
  job: jobSummarySchema.nullable(),
  // labels: what an add_label action adds (from its rule); null for other types.
  actions: z.array(z.object({ type: actionTypeSchema, status: actionStatusSchema, labels: z.array(z.string()).nullable() })),
  receivedAt: z.iso.datetime(),
})

export const eventPageSchema = z.object({
  items: z.array(eventItemSchema),
  nextCursor: z.string().nullable(),
  // Only counted on the first page; null when paging with a cursor.
  total: z.number().nullable(),
})

export const eventDetailSchema = eventItemSchema.extend({
  job: jobSummarySchema
    .extend({
      nextRunAt: z.iso.datetime(),
      lastError: z.string().nullable(),
      updatedAt: z.iso.datetime(),
    })
    .nullable(),
  actions: z.array(
    z.object({
      id: z.string(),
      ruleId: z.string(),
      ruleName: z.string(),
      type: actionTypeSchema,
      status: actionStatusSchema,
      attempts: z.number(),
      result: z.record(z.string(), z.unknown()).nullable(),
      error: z.string().nullable(),
      durationMs: z.number().nullable(),
      updatedAt: z.iso.datetime(),
    }),
  ),
  // Rules that acted on this delivery, with their current conditions.
  rules: z.array(z.object({ id: z.string(), name: z.string(), event: ruleEventSchema, conditions: ruleConditionsSchema })),
})

// configured is null when the backend could not reach GitHub to check.
export const webhookStatusSchema = z.object({
  configured: z.boolean().nullable(),
  lastDeliveryAt: z.iso.datetime().nullable(),
})

// Last 24 hours; eventsPrevious is the 24 hours before. jobs.pending/retrying/dead are current totals.
export const statsSchema = z.object({
  events: z.number(),
  eventsPrevious: z.number(),
  actionsSucceeded: z.number(),
  actionsFailed: z.number(),
  actionsByType: z.object({ add_label: z.number(), add_comment: z.number(), slack_notify: z.number() }),
  jobsDead: z.number(),
  jobs: z.object({ pending: z.number(), retrying: z.number(), dead: z.number(), succeeded: z.number() }),
  // Missed deliveries the catch-up job recovered in the last 24 hours.
  recoveredDeliveries: z.number(),
  webhook: webhookStatusSchema,
})

export type JobStatus = z.infer<typeof jobStatusSchema>
export type ActionType = z.infer<typeof actionTypeSchema>
export type ActionStatus = z.infer<typeof actionStatusSchema>
export type EventSummary = z.infer<typeof eventSummarySchema>
export type JobSummary = z.infer<typeof jobSummarySchema>
export type EventItem = z.infer<typeof eventItemSchema>
export type EventPage = z.infer<typeof eventPageSchema>
export type EventDetail = z.infer<typeof eventDetailSchema>
export type WebhookStatus = z.infer<typeof webhookStatusSchema>
export type Stats = z.infer<typeof statsSchema>
