import { useCallback, useState } from 'react'
import { useVisiblePolling } from '@/hooks/use-visible-polling'
import { type EventQuery, fetchEvents } from './api'

export const EVENTS_POLL_MS = 5_000
export const PAGE_SIZE = 25
// Older pages are a snapshot; they only refresh when the tab becomes visible again.
const OLDER_PAGE_POLL_MS = 60 * 60_000

export type EventFilters = Pick<EventQuery, 'repositoryId' | 'event' | 'status' | 'q'>

// One page of the log: Next pushes the page's cursor, Previous pops it. Mount with a key per filter set.
export function useEventLog(filters: EventFilters) {
  const [cursors, setCursors] = useState<string[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const before = cursors.at(-1) ?? null
  const { repositoryId, event, status, q } = filters

  const load = useCallback(
    async (signal: AbortSignal) => {
      const page = await fetchEvents({ repositoryId, event, status, q, before, limit: PAGE_SIZE }, signal)
      // Only the first page is counted; later pages keep that total.
      if (page.total !== null) setTotal(page.total)
      return { before, page }
    },
    [repositoryId, event, status, q, before],
  )
  const { data, error } = useVisiblePolling(load, before ? OLDER_PAGE_POLL_MS : EVENTS_POLL_MS, 'Could not load events.')
  // Tagged with its cursor, so a page change shows loading instead of the previous page's rows.
  const page = data?.before === before ? data.page : null
  const nextCursor = page?.nextCursor ?? null

  const next = useCallback(() => {
    if (nextCursor) setCursors((prev) => [...prev, nextCursor])
  }, [nextCursor])
  const previous = useCallback(() => setCursors((prev) => prev.slice(0, -1)), [])

  return {
    items: page?.items ?? null,
    error,
    total,
    pageIndex: cursors.length,
    hasNext: nextCursor !== null,
    hasPrevious: cursors.length > 0,
    next,
    previous,
  }
}
