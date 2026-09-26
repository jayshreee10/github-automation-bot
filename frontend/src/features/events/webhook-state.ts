import { timeAgo } from '@/lib/time'
import type { EventLog } from './schemas'

export type WebhookState = 'connected' | 'waiting' | 'off' | 'unknown'

export function webhookState(webhook: EventLog['webhook']): { state: WebhookState; label: string } {
  if (webhook.configured === false) return { state: 'off', label: 'Webhook not configured' }
  if (webhook.configured === null) return { state: 'unknown', label: 'Webhook status unknown' }
  if (!webhook.lastDeliveryAt) return { state: 'waiting', label: 'Webhook configured · no events yet' }
  return { state: 'connected', label: `Webhook connected · last event ${timeAgo(webhook.lastDeliveryAt)}` }
}
