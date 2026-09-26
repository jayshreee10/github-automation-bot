import { useCallback, useEffect, useState } from 'react'
import { deleteRule, fetchRules, updateRule } from './api'
import type { Rule } from './schemas'

// Rules for the selected repository (all when null). Toggle and remove update the list in place.
export function useRules(repoId: string | null) {
  // Tagged with the filter it was loaded for, so a filter change shows loading instead of stale rules.
  const [loaded, setLoaded] = useState<{ repoId: string | null; rules: Rule[] | null; error: string | null } | null>(null)
  const current = loaded?.repoId === repoId ? loaded : null
  const rules = current?.rules ?? null
  const error = current?.error ?? null
  const setRules = (update: (prev: Rule[] | null) => Rule[] | null) =>
    setLoaded((prev) => prev && { ...prev, rules: update(prev.rules) })

  useEffect(() => {
    const controller = new AbortController()
    fetchRules(repoId, controller.signal)
      .then((list) => setLoaded({ repoId, rules: list, error: null }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ repoId, rules: null, error: 'Could not load rules.' })
      })
    return () => controller.abort()
  }, [repoId])

  const replace = (rule: Rule) => setRules((prev) => prev?.map((r) => (r.id === rule.id ? rule : r)) ?? prev)

  const setEnabled = useCallback(async (rule: Rule, enabled: boolean) => {
    replace({ ...rule, enabled })
    try {
      replace(await updateRule(rule.id, { enabled }))
    } catch (err) {
      replace(rule)
      throw err
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteRule(id)
    setRules((prev) => prev?.filter((r) => r.id !== id) ?? prev)
  }, [])

  return { rules, error, setEnabled, remove }
}
