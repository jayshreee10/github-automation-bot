import { describe, expect, it } from 'vitest'
import type { Stats } from '@/features/events/schemas'
import { webhookHealth } from '@/features/shell/webhook-health'

const stats = (webhook: Stats['webhook']): Stats => ({
  events: 0,
  eventsPrevious: 0,
  actionsSucceeded: 0,
  actionsFailed: 0,
  actionsByType: { add_label: 0, add_comment: 0, slack_notify: 0 },
  jobsDead: 0,
  jobs: { pending: 2, retrying: 0, dead: 0, succeeded: 0 },
  recoveredDeliveries: 0,
  webhook,
})

describe('webhookHealth', () => {
  it('is healthy with a recent delivery', () => {
    const at = new Date(Date.now() - 3 * 60_000).toISOString()
    expect(webhookHealth(stats({ configured: true, lastDeliveryAt: at }))).toEqual({
      health: 'healthy',
      title: 'Webhook healthy',
      detail: 'Last delivery 3m ago · queue 2',
    })
  })

  it('waits when configured but nothing arrived', () => {
    expect(webhookHealth(stats({ configured: true, lastDeliveryAt: null })).health).toBe('waiting')
  })

  it('flags a missing webhook URL and an unknown status', () => {
    expect(webhookHealth(stats({ configured: false, lastDeliveryAt: null })).health).toBe('off')
    expect(webhookHealth(stats({ configured: null, lastDeliveryAt: null })).health).toBe('unknown')
  })
})
