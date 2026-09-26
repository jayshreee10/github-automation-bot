import { describe, expect, it } from 'vitest'
import type { SlackSettings } from '@/features/settings/schemas'
import { isDirty, maskedWebhook, toForm, toInput, webhookError } from '@/features/settings/slack-form'

const saved: SlackSettings = {
  connected: true,
  webhookLast4: 'abcd',
  channelLabel: '#eng',
  includeLink: true,
  updatedAt: '2026-09-27T10:00:00.000Z',
}

describe('slack form', () => {
  it('starts clean with an empty URL, meaning keep the saved webhook', () => {
    const values = toForm(saved)
    expect(values).toEqual({ webhookUrl: '', channelLabel: '#eng', includeLink: true })
    expect(isDirty(values, saved)).toBe(false)
  })

  it('sends only changed fields, trimmed, with an empty label as null', () => {
    expect(toInput({ webhookUrl: ' https://hooks.slack.com/services/T/B/x ', channelLabel: '', includeLink: false }, saved)).toEqual({
      webhookUrl: 'https://hooks.slack.com/services/T/B/x',
      channelLabel: null,
      includeLink: false,
    })
    expect(toInput({ webhookUrl: '', channelLabel: ' #eng ', includeLink: true }, saved)).toEqual({})
  })

  it('accepts only Slack incoming webhook URLs', () => {
    expect(webhookError('')).toBeNull()
    expect(webhookError('https://hooks.slack.com/services/T/B/x')).toBeNull()
    expect(webhookError('https://hooks.slack.com/services/')).toMatch(/Incoming Webhook/)
    expect(webhookError('https://example.com/services/T/B/x')).toMatch(/Incoming Webhook/)
  })

  it('masks all but the last 4 characters', () => {
    expect(maskedWebhook('abcd')).toBe('••••••••••••abcd')
  })
})
