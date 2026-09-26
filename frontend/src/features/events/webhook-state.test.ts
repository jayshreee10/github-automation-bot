import { describe, expect, it } from 'vitest'
import { webhookState } from './webhook-state'

describe('webhookState', () => {
  it('is off when the App has no webhook', () => {
    expect(webhookState({ configured: false, lastDeliveryAt: null }).state).toBe('off')
  })

  it('is unknown when GitHub could not be asked', () => {
    expect(webhookState({ configured: null, lastDeliveryAt: null }).state).toBe('unknown')
  })

  it('is waiting when configured but no events arrived', () => {
    expect(webhookState({ configured: true, lastDeliveryAt: null })).toEqual({
      state: 'waiting',
      label: 'Webhook configured · no events yet',
    })
  })

  it('is connected with the time of the last event', () => {
    const status = webhookState({ configured: true, lastDeliveryAt: new Date().toISOString() })
    expect(status.state).toBe('connected')
    expect(status.label).toBe('Webhook connected · last event just now')
  })
})
