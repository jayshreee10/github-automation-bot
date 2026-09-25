import { z } from 'zod'

export const meSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
})

export type Me = z.infer<typeof meSchema>

// GitHub ids arrive as strings (Postgres BigInt) so they never lose precision in JSON.
export const repositorySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  isPrivate: z.boolean(),
  installationId: z.string(),
  accountLogin: z.string(),
})

export const installationSummarySchema = z.object({
  id: z.string(),
  accountLogin: z.string(),
})

export const repositoryListSchema = z.object({
  installations: z.array(installationSummarySchema),
  repositories: z.array(repositorySchema),
})

export type Repository = z.infer<typeof repositorySchema>
export type RepositoryList = z.infer<typeof repositoryListSchema>

export const eventStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'dead'])

export const eventItemSchema = z.object({
  id: z.string(),
  event: z.string(),
  action: z.string().nullable(),
  repository: z.string(),
  title: z.string().nullable(),
  url: z.string().nullable(),
  status: eventStatusSchema,
  attempts: z.number(),
  lastError: z.string().nullable(),
  receivedAt: z.iso.datetime(),
})

// configured is null when the backend could not reach GitHub to check.
export const eventLogSchema = z.object({
  webhook: z.object({
    configured: z.boolean().nullable(),
    lastDeliveryAt: z.iso.datetime().nullable(),
  }),
  events: z.array(eventItemSchema),
})

export type EventStatus = z.infer<typeof eventStatusSchema>
export type EventItem = z.infer<typeof eventItemSchema>
export type EventLog = z.infer<typeof eventLogSchema>
