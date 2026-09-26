import { useCallback, useEffect, useRef, useState } from 'react'

// After this many failures in a row, poll at BACKOFF_MS instead of the normal interval.
const ERRORS_BEFORE_BACKOFF = 3
const BACKOFF_MS = 30_000

// Short polling: fetches once on mount, then every intervalMs while the tab is visible, and again as soon as it is shown.
// The in-flight request is aborted on unmount. load must be stable (module-level or memoised).
export function useVisiblePolling<T>(load: (signal: AbortSignal) => Promise<T>, intervalMs: number, errorMessage: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refreshRef = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let failures = 0
    const controller = new AbortController()

    async function tick(force = false) {
      clearTimeout(timer)
      if (force || !document.hidden) {
        try {
          const body = await load(controller.signal)
          if (cancelled) return
          failures = 0
          setData(body)
          setError(null)
        } catch {
          if (cancelled) return
          failures += 1
          setError(errorMessage)
        }
      }
      if (!cancelled) timer = setTimeout(tick, failures >= ERRORS_BEFORE_BACKOFF ? BACKOFF_MS : intervalMs)
    }

    const onVisible = () => {
      if (!document.hidden) tick()
    }
    refreshRef.current = () => tick(true)
    tick(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, intervalMs, errorMessage])

  // Fetch now, e.g. after a retry, instead of waiting for the next tick.
  const refresh = useCallback(() => refreshRef.current(), [])

  return { data, error, refresh }
}
