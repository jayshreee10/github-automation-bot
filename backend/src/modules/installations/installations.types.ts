import { z } from 'zod';

// GitHub ids are BigInt in Postgres; the API sends them as strings so JSON never loses precision.
export const repositorySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  isPrivate: z.boolean(),
  installationId: z.string(),
  accountLogin: z.string(),
});

export const installationSummarySchema = z.object({
  id: z.string(),
  accountLogin: z.string(),
});

export const repositoryListSchema = z.object({
  installations: z.array(installationSummarySchema),
  repositories: z.array(repositorySchema),
});

export const connectBodySchema = z.object({
  installationId: z.coerce.number().int().positive(),
});

export const installationIdParamSchema = z.coerce.number().int().positive();

export type RepositoryDto = z.infer<typeof repositorySchema>;
export type RepositoryList = z.infer<typeof repositoryListSchema>;
export type ConnectBody = z.infer<typeof connectBodySchema>;
