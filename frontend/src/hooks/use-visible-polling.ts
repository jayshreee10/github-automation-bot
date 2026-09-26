import { useEffect, useState } from 'react'

// Short polling: fetches once on mount, then every intervalMs while the tab is visible, and again as soon as it is shown.
// load must be stable (module-level or memoised), or polling restarts on every render.
export function useVisiblePolling<T>(load: () => Promise<T>, intervalMs: number, errorMessage: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function tick(force = false) {
      clearTimeout(timer)
      if (force || !document.hidden) {
        try {
          const body = await load()
          if (!cancelled) {
            setData(body)
            setError(null)
          }
        } catch {
          if (!cancelled) setError(errorMessage)
        }
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs)
    }

    const onVisible = () => {
      if (!document.hidden) tick()
    }
    tick(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, intervalMs, errorMessage])

  return { data, error }
}
