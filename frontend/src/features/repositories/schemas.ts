import { z } from 'zod'

// GitHub ids arrive as strings (Postgres BigInt) so they never lose precision in JSON.
export const repositorySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  isPrivate: z.boolean(),
  defaultBranch: z.string().nullable(),
  installationId: z.string(),
  accountLogin: z.string(),
  ruleCount: z.number(),
  lastEventAt: z.iso.datetime().nullable(),
})

// accountType is User or Organization; repositorySelection is all or selected.
export const installationSummarySchema = z.object({
  id: z.string(),
  accountLogin: z.string(),
  accountType: z.string().nullable(),
  repositorySelection: z.string().nullable(),
})

// The GitHub App's granted permissions (e.g. issues: write) and subscribed webhook events.
export const appInfoSchema = z.object({
  events: z.array(z.string()),
  permissions: z.record(z.string(), z.string()),
})

export const repositoryListSchema = z.object({
  installations: z.array(installationSummarySchema),
  repositories: z.array(repositorySchema),
})

export type Repository = z.infer<typeof repositorySchema>
export type RepositoryList = z.infer<typeof repositoryListSchema>
export type Installation = z.infer<typeof installationSummarySchema>
export type AppInfo = z.infer<typeof appInfoSchema>
