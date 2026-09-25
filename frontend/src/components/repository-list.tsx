import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { env } from '@/lib/env'
import { type Repository, type RepositoryList as Data, repositoryListSchema } from '@/lib/schemas'

const INSTALL_URL = `https://github.com/apps/${env.VITE_GITHUB_APP_SLUG}/installations/new`

type Group = { installationId: string; accountLogin: string; repos: Repository[] }

// Every installation gets a group, even with zero repos, so Sync / Manage stay reachable.
function groupByInstallation(data: Data): Group[] {
  return data.installations.map((i) => ({
    installationId: i.id,
    accountLogin: i.accountLogin,
    repos: data.repositories.filter((r) => r.installationId === i.id),
  }))
}

export function RepositoryList() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/repositories', repositoryListSchema)
      .then(setData)
      .catch(() => setError('Could not load repositories.'))
  }, [])

  async function sync(installationId: string) {
    setSyncing(installationId)
    try {
      const body = await apiFetch(`/installations/${installationId}/sync`, repositoryListSchema, {
        method: 'POST',
      })
      setData(body)
      setError(null)
    } catch {
      setError('Sync failed. Please try again.')
    } finally {
      setSyncing(null)
    }
  }

  return (
    <section className="repo-section">
      <header className="repo-header">
        <h2 className="section-title">Repositories</h2>
        <Button asChild>
          <a href={INSTALL_URL}>Connect repository</a>
        </Button>
      </header>

      {error && <p className="error-text">{error}</p>}
      {data === null && !error && <p className="muted-text">Loading…</p>}
      {data?.installations.length === 0 && (
        <p className="muted-text">No repositories connected yet. Install the GitHub App to get started.</p>
      )}

      {data &&
        groupByInstallation(data).map((group) => (
          <div key={group.installationId} className="repo-group">
            <div className="repo-group-header">
              <span className="repo-account">{group.accountLogin}</span>
              <div className="repo-group-actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncing === group.installationId}
                  onClick={() => sync(group.installationId)}
                >
                  {syncing === group.installationId ? 'Syncing…' : 'Sync'}
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={`https://github.com/settings/installations/${group.installationId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manage on GitHub
                  </a>
                </Button>
              </div>
            </div>
            {group.repos.length === 0 && (
              <p className="repo-empty">
                No repositories visible. Check the App's permissions and repository access on GitHub, then Sync.
              </p>
            )}
            <ul className="repo-list">
              {group.repos.map((repo) => (
                <li key={repo.id} className="repo-item">
                  <a
                    className="repo-name"
                    href={`https://github.com/${repo.fullName}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {repo.fullName}
                  </a>
                  {repo.isPrivate && <span className="repo-badge">Private</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  )
}
