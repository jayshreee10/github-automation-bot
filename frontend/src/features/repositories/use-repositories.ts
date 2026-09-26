import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { fetchRepositories, syncInstallation } from './api'
import type { RepositoryList } from './schemas'

// Older data is refetched in the background when another component mounts.
const STALE_MS = 30_000

interface Snapshot {
  data: RepositoryList | null
  error: string | null
}

// One store for the whole app: the sidebar, top bar and page share a single request instead of one each.
let snapshot: Snapshot = { data: null, error: null }
let loadedAt = 0
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function publish(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next }
  listeners.forEach((l) => l())
}

function setList(data: RepositoryList) {
  loadedAt = Date.now()
  publish({ data, error: null })
}

// Concurrent callers share the in-flight request.
function load(): Promise<void> {
  inFlight ??= fetchRepositories()
    .then(setList)
    .catch(() => publish({ error: 'Could not load repositories.' }))
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

// Tests only: forget the shared list between cases.
export function resetRepositoriesStore() {
  snapshot = { data: null, error: null }
  loadedAt = 0
  inFlight = null
}

// The caller's repositories. sync() re-fetches one installation; syncAll() every one, in turn.
export function useRepositories() {
  const { data, error } = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => snapshot,
  )
  // An installation id, 'all' during syncAll, or null.
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    if (!snapshot.data || Date.now() - loadedAt > STALE_MS) void load()
  }, [])

  const sync = useCallback(async (installationId: string) => {
    setSyncing(installationId)
    try {
      setList(await syncInstallation(installationId))
    } catch {
      publish({ error: 'Sync failed. Please try again.' })
    } finally {
      setSyncing(null)
    }
  }, [])

  // Sequential: each sync hits GitHub; one at a time keeps us well inside rate limits. Resolves true on success.
  const syncAll = useCallback(async (): Promise<boolean> => {
    const current = snapshot.data
    if (!current) return false
    setSyncing('all')
    try {
      let latest = current
      for (const i of current.installations) latest = await syncInstallation(i.id)
      setList(latest)
      return true
    } catch {
      return false
    } finally {
      setSyncing(null)
    }
  }, [])

  return { data, error, syncing, sync, syncAll }
}
