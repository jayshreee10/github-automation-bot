import { apiFetch, apiSend, jsonInit } from '@/lib/api'
import { type SlackSettings, type SlackSettingsInput, slackSettingsSchema } from './schemas'

export function fetchSlackSettings(signal?: AbortSignal): Promise<SlackSettings> {
  return apiFetch('/settings/slack', slackSettingsSchema, { signal })
}

export function saveSlackSettings(input: SlackSettingsInput): Promise<SlackSettings> {
  return apiFetch('/settings/slack', slackSettingsSchema, jsonInit('PUT', input))
}

// Without a URL the server tests the webhook rules would use.
export function sendSlackTest(webhookUrl?: string): Promise<void> {
  return apiSend('/settings/slack/test', jsonInit('POST', webhookUrl ? { webhookUrl } : {}))
}
