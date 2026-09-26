import { Button } from '@/components/ui/button'
import { INSTALL_URL } from './github-urls'
import { groupByInstallation } from './group-by-installation'
import { InstallationGroup } from './installation-group'
import { useRepositories } from './use-repositories'

export function RepositoryList() {
  const { data, error, syncing, sync } = useRepositories()

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
          <InstallationGroup
            key={group.installationId}
            group={group}
            syncing={syncing === group.installationId}
            onSync={sync}
          />
        ))}
    </section>
  )
}
