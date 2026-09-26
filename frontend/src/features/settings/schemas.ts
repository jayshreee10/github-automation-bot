import { z } from 'zod'

// connected: a webhook is saved. Without one, Slack actions in rules fail.
export const slackSettingsSchema = z.object({
  connected: z.boolean(),
  webhookLast4: z.string().nullable(),
  channelLabel: z.string().nullable(),
  includeLink: z.boolean(),
  updatedAt: z.iso.datetime().nullable(),
})

export type SlackSettings = z.infer<typeof slackSettingsSchema>

// webhookUrl: a new URL replaces the stored one, null removes it, absent keeps it.
export interface SlackSettingsInput {
  webhookUrl?: string | null
  channelLabel?: string | null
  includeLink?: boolean
}
