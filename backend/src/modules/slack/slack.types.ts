import { z } from 'zod';

// Only Slack's own webhook host, so the server never posts elsewhere.
export const slackWebhookUrlSchema = z
  .url({ protocol: /^https$/, hostname: /^hooks\.slack\.com$/ })
  .max(500)
  // Refinements still run after a failed url check, so parse defensively.
  .refine(
    (u) => URL.canParse(u) && new URL(u).pathname.startsWith('/services/'),
    {
      message: 'must be a https://hooks.slack.com/services/… URL',
    },
  );

// connected: a webhook is saved. Without one, Slack actions in rules fail with a clear error.
export const slackSettingsSchema = z.object({
  connected: z.boolean(),
  webhookLast4: z.string().nullable(),
  channelLabel: z.string().nullable(),
  includeLink: z.boolean(),
  updatedAt: z.iso.datetime().nullable(),
});

// webhookUrl: a new URL replaces the stored one, null removes it (Slack off), absent keeps it.
export const updateSlackSettingsSchema = z
  .object({
    webhookUrl: slackWebhookUrlSchema.nullable(),
    channelLabel: z.string().trim().max(80).nullable(),
    includeLink: z.boolean(),
  })
  .partial();

// No URL: test the saved webhook. With a URL: test it before saving.
export const testSlackSchema = z.object({
  webhookUrl: slackWebhookUrlSchema.optional(),
});

export type SlackSettings = z.infer<typeof slackSettingsSchema>;
export type UpdateSlackSettingsBody = z.infer<typeof updateSlackSettingsSchema>;
export type TestSlackBody = z.infer<typeof testSlackSchema>;
