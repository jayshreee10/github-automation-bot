import { useCallback } from 'react'
import { useVisiblePolling } from '@/hooks/use-visible-polling'
import { fetchStats } from './api'

export const STATS_POLL_MS = 15_000

// Last-24-hour counts, queue state and webhook health; null repoId means every repository.
export function useStats(repoId: string | null, intervalMs = STATS_POLL_MS) {
  const load = useCallback((signal: AbortSignal) => fetchStats(repoId, signal), [repoId])
  return useVisiblePolling(load, intervalMs, 'Could not load stats.')
}
