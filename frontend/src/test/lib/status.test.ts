import { describe, expect, it } from 'vitest'
import { actionTone, deliveryStatus, eventKey } from '@/lib/status'

const job = (status: 'pending' | 'running' | 'succeeded' | 'failed' | 'dead', attempts = 1) => ({
  id: 'j',
  status,
  attempts,
  maxAttempts: 5,
})

describe('status helpers', () => {
  it('joins event and action like GitHub does', () => {
    expect(eventKey('issues', 'opened')).toBe('issues.opened')
    expect(eventKey('push', null)).toBe('push')
  })

  it.each([
    [null, 0, 'muted', 'Recorded'],
    [job('pending'), 0, 'muted', 'Queued'],
    [job('running'), 0, 'muted', 'Running'],
    [job('failed', 2), 1, 'warn', 'Retrying 2/5'],
    [job('dead', 5), 1, 'destructive', 'Dead'],
    [job('succeeded'), 0, 'outline', 'No rule matched'],
    [job('succeeded'), 1, 'success', 'Done · 1 action'],
    [job('succeeded'), 2, 'success', 'Done · 2 actions'],
  ] as const)('deliveryStatus(%j, %i) → %s %s', (j, count, tone, text) => {
    expect(deliveryStatus(j, count)).toEqual({ tone, text })
  })

  it('maps action statuses to tones', () => {
    expect(actionTone('succeeded')).toBe('success')
    expect(actionTone('failed')).toBe('destructive')
    expect(actionTone('pending')).toBe('muted')
    expect(actionTone('skipped')).toBe('outline')
  })
})
