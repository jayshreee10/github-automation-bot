import { describe, expect, it } from 'vitest'
import { eventPageSchema, statsSchema } from '@/features/events/schemas'
import { eventItem } from '../../fixtures'

describe('eventPageSchema', () => {
  it('accepts a page of events', () => {
    const page = { items: [eventItem(1)], nextCursor: 'abc', total: 1 }
    expect(eventPageSchema.parse(page)).toEqual(page)
  })

  it('rejects an unknown job status', () => {
    const bad = eventItem(1, { job: { id: 'j', status: 'lost' as never, attempts: 1, maxAttempts: 5 } })
    expect(eventPageSchema.safeParse({ items: [bad], nextCursor: null, total: null }).success).toBe(false)
  })

  it('rejects a non-ISO receivedAt', () => {
    expect(eventPageSchema.safeParse({ items: [eventItem(1, { receivedAt: 'yesterday' })], nextCursor: null, total: null }).success).toBe(false)
  })
})

describe('statsSchema', () => {
  it('accepts counts with webhook status', () => {
    const stats = {
      events: 1,
      eventsPrevious: 0,
      actionsSucceeded: 2,
      actionsFailed: 0,
      actionsByType: { add_label: 1, add_comment: 1, slack_notify: 0 },
      jobsDead: 0,
      jobs: { pending: 0, retrying: 0, dead: 0, succeeded: 1 },
      recoveredDeliveries: 0,
      webhook: { configured: null, lastDeliveryAt: null },
    }
    expect(statsSchema.parse(stats)).toEqual(stats)
  })
})
