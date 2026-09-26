import { useEffect, useState } from 'react'
import { fetchRepositories, syncInstallation } from './api'
import type { RepositoryList } from './schemas'

// Loads the caller's repositories once; sync() re-fetches one installation from GitHub and replaces the list.
export function useRepositories() {
  const [data, setData] = useState<RepositoryList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    fetchRepositories()
      .then(setData)
      .catch(() => setError('Could not load repositories.'))
  }, [])

  async function sync(installationId: string) {
    setSyncing(installationId)
    try {
      setData(await syncInstallation(installationId))
      setError(null)
    } catch {
      setError('Sync failed. Please try again.')
    } finally {
      setSyncing(null)
    }
  }

  return { data, error, syncing, sync }
}
