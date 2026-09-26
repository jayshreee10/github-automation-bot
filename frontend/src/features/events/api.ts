import { apiFetch, query } from '@/lib/api'
import {
  type EventDetail,
  eventDetailSchema,
  type EventPage,
  eventPageSchema,
  type JobStatus,
  type Stats,
  statsSchema,
} from './schemas'

export interface EventQuery {
  repositoryId?: string | null
  event?: 'issues' | 'pull_request' | 'push' | null
  status?: JobStatus | null
  q?: string | null
  before?: string | null
  limit?: number
}

export function fetchEvents(q: EventQuery, signal?: AbortSignal): Promise<EventPage> {
  return apiFetch(`/events${query({ ...q })}`, eventPageSchema, { signal })
}

export function fetchEventDetail(deliveryId: string, signal?: AbortSignal): Promise<EventDetail> {
  return apiFetch(`/events/${encodeURIComponent(deliveryId)}`, eventDetailSchema, { signal })
}

export function fetchStats(repositoryId: string | null, signal?: AbortSignal): Promise<Stats> {
  return apiFetch(`/stats${query({ repositoryId })}`, statsSchema, { signal })
}
