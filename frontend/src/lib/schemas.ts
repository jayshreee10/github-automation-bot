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
