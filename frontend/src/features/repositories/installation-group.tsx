import { Button } from '@/components/ui/button'
import type { InstallationGroupData } from './group-by-installation'
import { manageInstallationUrl, repositoryUrl } from './github-urls'

type Props = {
  group: InstallationGroupData
  syncing: boolean
  onSync: (installationId: string) => void
}

export function InstallationGroup({ group, syncing, onSync }: Props) {
  return (
    <div className="repo-group">
      <div className="repo-group-header">
        <span className="repo-account">{group.accountLogin}</span>
        <div className="repo-group-actions">
          <Button variant="outline" size="sm" disabled={syncing} onClick={() => onSync(group.installationId)}>
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={manageInstallationUrl(group.installationId)} target="_blank" rel="noreferrer">
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
            <a className="repo-name" href={repositoryUrl(repo.fullName)} target="_blank" rel="noreferrer">
              {repo.fullName}
            </a>
            {repo.isPrivate && <span className="repo-badge">Private</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
