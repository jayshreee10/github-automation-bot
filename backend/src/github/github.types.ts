import { z } from 'zod';

// Only the fields we use from GitHub's REST responses; extra fields are stripped.
export const githubAccountSchema = z.object({
  id: z.number(),
  login: z.string(),
  type: z.string(),
});

export const githubInstallationSchema = z.object({
  id: z.number(),
  account: githubAccountSchema,
});

export const installationTokenSchema = z.object({
  token: z.string(),
  expires_at: z.iso.datetime(),
});

export const githubRepositorySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  private: z.boolean(),
});

export const installationReposPageSchema = z.object({
  total_count: z.number(),
  repositories: z.array(githubRepositorySchema),
});

export type GithubInstallation = z.infer<typeof githubInstallationSchema>;
export type GithubRepository = z.infer<typeof githubRepositorySchema>;
