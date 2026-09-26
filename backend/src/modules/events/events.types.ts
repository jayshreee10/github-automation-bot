import { z } from 'zod';
import { ruleConditionsSchema, ruleEventSchema } from '../rules/rule.schema.js';
import { eventSummarySchema } from './event-summary.js';
import { REPO_EVENTS } from './repo-event.js';

export const JOB_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'dead',
] as const;

export const jobStatusSchema = z.enum(JOB_STATUSES);
export const actionTypeSchema = z.enum([
  'add_label',
  'add_comment',
  'slack_notify',
  'ai_triage',
]);
export const actionStatusSchema = z.enum([
  'pending',
  'succeeded',
  'failed',
  'skipped',
]);

// GitHub ids are BigInt in Postgres, so they travel as digit strings.
export const repositoryIdSchema = z.string().regex(/^\d{1,20}$/);

export const repositoryRefSchema = z.object({
  id: z.string(),
  fullName: z.string(),
});

// maxAttempts lets the UI show "2 / 5" without hard-coding the queue limit.
const jobSummarySchema = z.object({
  id: z.string(),
  status: jobStatusSchema,
  attempts: z.number(),
  maxAttempts: z.number(),
});

export const eventItemSchema = z.object({
  id: z.string(),
  event: z.string(),
  action: z.string().nullable(),
  repository: repositoryRefSchema,
  summary: eventSummarySchema,
  job: jobSummarySchema.nullable(),
  // labels: what an add_label action adds, from its rule; null for other types.
  actions: z.array(
    z.object({
      type: actionTypeSchema,
      status: actionStatusSchema,
      labels: z.array(z.string()).nullable(),
    }),
  ),
  receivedAt: z.iso.datetime(),
});

export const eventPageSchema = z.object({
  items: z.array(eventItemSchema),
  nextCursor: z.string().nullable(),
  // Matching events for the filters; only counted on the first page (no `before`).
  total: z.number().nullable(),
});

export const eventListQuerySchema = z.object({
  repositoryId: repositoryIdSchema.optional(),
  event: z.enum(REPO_EVENTS).optional(),
  status: jobStatusSchema.optional(),
  // Title, author or delivery id prefix; case-insensitive.
  q: z.string().trim().min(1).max(100).optional(),
  before: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

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
      // What the action did, e.g. labels added or the comment link. Errors are redacted when stored.
      result: z.record(z.string(), z.unknown()).nullable(),
      error: z.string().nullable(),
      durationMs: z.number().nullable(),
      updatedAt: z.iso.datetime(),
    }),
  ),
  // Rules that acted on this delivery, with their current conditions.
  rules: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      event: ruleEventSchema,
      conditions: ruleConditionsSchema,
    }),
  ),
});

export const deliveryIdParamSchema = z.guid();

export const repositoryFilterSchema = z.object({
  repositoryId: repositoryIdSchema.optional(),
});

// configured is null when GitHub could not be asked; lastDeliveryAt is the newest event in scope.
export const webhookStatusSchema = z.object({
  configured: z.boolean().nullable(),
  lastDeliveryAt: z.iso.datetime().nullable(),
});

// Counts over the last 24 hours, plus webhook health. eventsPrevious covers the 24 hours before that.
// jobs: pending, retrying and dead are current totals; succeeded is the last 24 hours.
export const statsSchema = z.object({
  events: z.number(),
  eventsPrevious: z.number(),
  actionsSucceeded: z.number(),
  actionsFailed: z.number(),
  actionsByType: z.object({
    add_label: z.number(),
    add_comment: z.number(),
    slack_notify: z.number(),
  }),
  jobsDead: z.number(),
  jobs: z.object({
    pending: z.number(),
    retrying: z.number(),
    dead: z.number(),
    succeeded: z.number(),
  }),
  // Missed deliveries the catch-up job recovered, last 24 hours.
  recoveredDeliveries: z.number(),
  webhook: webhookStatusSchema,
});

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type EventItem = z.infer<typeof eventItemSchema>;
export type EventPage = z.infer<typeof eventPageSchema>;
export type EventListQuery = z.infer<typeof eventListQuerySchema>;
export type EventDetail = z.infer<typeof eventDetailSchema>;
export type RepositoryFilter = z.infer<typeof repositoryFilterSchema>;
export type Stats = z.infer<typeof statsSchema>;
