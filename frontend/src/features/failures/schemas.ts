import { z } from 'zod'
import { actionStatusSchema, actionTypeSchema, eventSummarySchema, jobStatusSchema, repositoryRefSchema } from '@/features/events/schemas'

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
  // Every action of the delivery; a pending one with an error is waiting for a retry.
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
})

export const failureListSchema = z.object({ items: z.array(failureSchema) })

export type Failure = z.infer<typeof failureSchema>
export type FailureList = z.infer<typeof failureListSchema>

// Actions worth showing on the failures page: failed ones, and pending ones that already hit an error.
export function problemActions(f: Failure): Failure['actions'] {
  return f.actions.filter((a) => a.status === 'failed' || (a.status === 'pending' && a.error))
}
