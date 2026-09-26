import { useVisiblePolling } from '@/hooks/use-visible-polling'
import { fetchEventLog } from './api'

const POLL_MS = 5_000
const LIMIT = 20

// Module-level so the polling hook sees a stable function.
const loadEventLog = () => fetchEventLog(LIMIT)

export function useEventLog() {
  return useVisiblePolling(loadEventLog, POLL_MS, 'Could not load events.')
}
