import { useEffect, useState } from 'react'
import { fetchRules } from '@/features/rules/api'

export interface RuleCounts {
  enabled: number
  total: number
  repositories: number
}

// Rules change rarely, so the dashboard loads them once per repo filter instead of polling.
export function useRuleCounts(repoId: string | null) {
  const [loaded, setLoaded] = useState<{ repoId: string | null; counts: RuleCounts | null } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchRules(repoId, controller.signal)
      .then((rules) => {
        const enabled = rules.filter((r) => r.enabled)
        setLoaded({
          repoId,
          counts: {
            enabled: enabled.length,
            total: rules.length,
            repositories: new Set(enabled.map((r) => r.repositoryId)).size,
          },
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ repoId, counts: null })
      })
    return () => controller.abort()
  }, [repoId])

  return loaded?.repoId === repoId ? loaded.counts : null
}
