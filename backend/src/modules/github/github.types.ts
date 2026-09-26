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
  repository_selection: z.enum(['all', 'selected']).nullish(),
});

export const installationTokenSchema = z.object({
  token: z.string(),
  expires_at: z.iso.datetime(),
});

export const githubRepositorySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  private: z.boolean(),
  default_branch: z.string().nullish(),
});

export const installationReposPageSchema = z.object({
  total_count: z.number(),
  repositories: z.array(githubRepositorySchema),
});

// One attempt to deliver a webhook. guid is the X-GitHub-Delivery id; redeliveries share it.
// id exceeds 2^53, so it arrives as a string from the lossless parser; never use it as a number.
export const hookDeliverySchema = z.object({
  id: z.union([z.string().regex(/^\d+$/), z.number()]).transform(String),
  guid: z.string(),
  delivered_at: z.iso.datetime({ offset: true }),
  status_code: z.number(),
  event: z.string(),
});

// App webhook settings. The secret comes back masked; the URL is never sent to the browser.
export const hookConfigSchema = z.object({
  url: z.string().nullish(),
  content_type: z.string().nullish(),
});

// The App's granted permissions (e.g. issues: write) and subscribed webhook events.
export const githubAppSchema = z.object({
  events: z.array(z.string()),
  permissions: z.record(z.string(), z.string()),
});

export type GithubApp = z.infer<typeof githubAppSchema>;
export type GithubHookDelivery = z.infer<typeof hookDeliverySchema>;
export type GithubInstallation = z.infer<typeof githubInstallationSchema>;
export type GithubRepository = z.infer<typeof githubRepositorySchema>;
