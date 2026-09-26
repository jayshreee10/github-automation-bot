import type { Stats } from '@/features/events/schemas'
import { shortAge } from '@/lib/time'

export type Health = 'healthy' | 'waiting' | 'off' | 'unknown'

// Sidebar box: headline plus "Last delivery 12s ago · queue 0".
export function webhookHealth(stats: Stats): { health: Health; title: string; detail: string } {
  const queue = `queue ${stats.jobs.pending}`
  const { configured, lastDeliveryAt } = stats.webhook
  if (configured === false) return { health: 'off', title: 'Webhook not configured', detail: 'Set a webhook URL in the GitHub App' }
  if (configured === null) return { health: 'unknown', title: 'Webhook status unknown', detail: queue }
  if (!lastDeliveryAt) return { health: 'waiting', title: 'Waiting for events', detail: `No deliveries yet · ${queue}` }
  return { health: 'healthy', title: 'Webhook healthy', detail: `Last delivery ${shortAge(lastDeliveryAt)} ago · ${queue}` }
}
