import { useEffect, useState } from 'react'
import { fetchAppInfo } from './api'
import type { AppInfo } from './schemas'

// App permissions and events change rarely; load once per page visit.
export function useAppInfo() {
  const [state, setState] = useState<{ data: AppInfo | null; error: boolean }>({ data: null, error: false })

  useEffect(() => {
    const controller = new AbortController()
    fetchAppInfo(controller.signal)
      .then((data) => setState({ data, error: false }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ data: null, error: true })
      })
    return () => controller.abort()
  }, [])

  return state
}
