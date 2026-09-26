import { apiFetch } from '@/lib/api'
import { type EventLog, eventLogSchema } from './schemas'

export function fetchEventLog(limit: number): Promise<EventLog> {
  return apiFetch(`/events?limit=${limit}`, eventLogSchema)
}
