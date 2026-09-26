import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

const PARAM = 'repo'
const REPO_ID = /^\d{1,20}$/

// The selected repository lives in the URL (?repo=<id>), so reloads and shared links keep it.
export function useRepoFilter() {
  const [params, setParams] = useSearchParams()
  const raw = params.get(PARAM)
  const repoId = raw && REPO_ID.test(raw) ? raw : null

  const setRepoId = useCallback(
    (id: string | null) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set(PARAM, id)
        else next.delete(PARAM)
        return next
      }),
    [setParams],
  )

  return { repoId, setRepoId, search: repoId ? `?${PARAM}=${repoId}` : '' }
}
