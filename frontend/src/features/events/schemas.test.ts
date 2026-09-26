import { describe, expect, it } from 'vitest'
import { eventLogSchema } from './schemas'

const event = {
  id: 'd-1',
  event: 'issues',
  action: 'opened',
  repository: 'acme/api',
  title: 'bug: crash',
  url: 'https://github.com/acme/api/issues/1',
  status: 'succeeded',
  attempts: 1,
  lastError: null,
  receivedAt: '2026-09-26T12:00:00Z',
}

describe('eventLogSchema', () => {
  it('accepts a valid event log', () => {
    const log = { webhook: { configured: true, lastDeliveryAt: null }, events: [event] }
    expect(eventLogSchema.parse(log)).toEqual(log)
  })

  it('rejects an unknown job status', () => {
    const log = { webhook: { configured: true, lastDeliveryAt: null }, events: [{ ...event, status: 'lost' }] }
    expect(eventLogSchema.safeParse(log).success).toBe(false)
  })

  it('rejects a non-ISO receivedAt', () => {
    const log = { webhook: { configured: null, lastDeliveryAt: null }, events: [{ ...event, receivedAt: 'yesterday' }] }
    expect(eventLogSchema.safeParse(log).success).toBe(false)
  })
})
