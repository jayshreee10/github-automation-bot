import type { SlackSettings, SlackSettingsInput } from './schemas'

export interface SlackFormValues {
  // Empty means "keep the saved webhook".
  webhookUrl: string
  channelLabel: string
  includeLink: boolean
}

export const WEBHOOK_PREFIX = 'https://hooks.slack.com/services/'

export function toForm(settings: SlackSettings): SlackFormValues {
  return { webhookUrl: '', channelLabel: settings.channelLabel ?? '', includeLink: settings.includeLink }
}

// Same check as the API, so a typo is caught before the round trip.
export function webhookError(url: string): string | null {
  const value = url.trim()
  if (!value) return null
  return value.startsWith(WEBHOOK_PREFIX) && value.length > WEBHOOK_PREFIX.length
    ? null
    : `Use the Incoming Webhook URL from Slack (${WEBHOOK_PREFIX}…)`
}

// Only changed fields are sent; the webhook only when a new one was typed.
export function toInput(values: SlackFormValues, saved: SlackSettings): SlackSettingsInput {
  const input: SlackSettingsInput = {}
  const url = values.webhookUrl.trim()
  if (url) input.webhookUrl = url
  const label = values.channelLabel.trim()
  if (label !== (saved.channelLabel ?? '')) input.channelLabel = label || null
  if (values.includeLink !== saved.includeLink) input.includeLink = values.includeLink
  return input
}

export function isDirty(values: SlackFormValues, saved: SlackSettings): boolean {
  return Object.keys(toInput(values, saved)).length > 0
}

export function maskedWebhook(last4: string | null): string {
  return `••••••••••••${last4 ?? ''}`
}
