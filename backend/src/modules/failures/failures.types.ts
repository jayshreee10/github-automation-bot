import { z } from 'zod';
import { eventSummarySchema } from '../events/event-summary.js';
import {
  actionStatusSchema,
  actionTypeSchema,
  jobStatusSchema,
  repositoryRefSchema,
} from '../events/events.types.js';

// A job that failed or died, or that finished with failed actions. Error text is redacted when stored.
// actions: every action of the delivery; a pending one with an error is waiting for a retry.
export const failureSchema = z.object({
  jobId: z.string(),
  deliveryId: z.string(),
  event: z.string(),
  action: z.string().nullable(),
  repository: repositoryRefSchema,
  summary: eventSummarySchema,
  status: jobStatusSchema,
  attempts: z.number(),
  maxAttempts: z.number(),
  lastError: z.string().nullable(),
  nextRunAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  actions: z.array(
    z.object({
      id: z.string(),
      type: actionTypeSchema,
      ruleName: z.string(),
      status: actionStatusSchema,
      attempts: z.number(),
      error: z.string().nullable(),
    }),
  ),
  retryable: z.boolean(),
});

export const failureListSchema = z.object({ items: z.array(failureSchema) });

export const jobIdParamSchema = z.uuid();

export const retryResponseSchema = z.object({ queued: z.literal(true) });

export type Failure = z.infer<typeof failureSchema>;
export type FailureList = z.infer<typeof failureListSchema>;
