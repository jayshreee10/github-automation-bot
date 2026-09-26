import { z } from 'zod';

// GitHub ids are BigInt in Postgres; the API sends them as strings so JSON never loses precision.
export const repositorySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  isPrivate: z.boolean(),
  // Null until the next sync for repos stored before this field existed.
  defaultBranch: z.string().nullable(),
  installationId: z.string(),
  accountLogin: z.string(),
  ruleCount: z.number(),
  lastEventAt: z.iso.datetime().nullable(),
});

// accountType (User / Organization) and repositorySelection (all / selected) fill in on the next sync.
export const installationSummarySchema = z.object({
  id: z.string(),
  accountLogin: z.string(),
  accountType: z.string().nullable(),
  repositorySelection: z.string().nullable(),
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
