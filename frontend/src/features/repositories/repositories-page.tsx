import { Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { TopBar } from '@/features/shell/top-bar'
import { AppDetails } from './app-details'
import { INSTALL_URL } from './github-urls'
import { groupByInstallation } from './group-by-installation'
import { InstallationCard } from './installation-card'
import { DEFAULT_EVENTS } from './installation-detail'
import { useAppInfo } from './use-app-info'
import { useRepositories } from './use-repositories'

export function RepositoriesPage() {
  const { data, error, syncing, syncAll } = useRepositories()
  const app = useAppInfo()
  const events = app.data?.events ?? DEFAULT_EVENTS
  const busy = syncing !== null

  async function syncEverything() {
    if (await syncAll()) toast.success('Repositories synced from GitHub')
    else toast.error('Sync failed. Please try again.')
  }

  return (
    <>
      <TopBar crumbs={[{ label: 'Workspace' }, { label: 'Repositories' }]} />
      <div className="page">
        <div className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">Repositories</h1>
            <p className="page-subtitle">Repos the GitHub App can see. Webhooks arrive only from these.</p>
          </div>
          <div className="page-head-actions">
            <Button variant="outline" onClick={syncEverything} disabled={busy || !data?.installations.length}>
              <RefreshCw className={busy ? 'sync-spin' : undefined} />
              {busy ? 'Syncing…' : 'Sync from GitHub'}
            </Button>
            <Button asChild>
              <a href={INSTALL_URL}>
                <Plus />
                Connect repository
              </a>
            </Button>
          </div>
        </div>

        <div className="repos-layout">
          <div className="repos-main">
            {error && <p className="error-text">{error}</p>}
            {!data && !error && <Skeleton className="table-skeleton" />}
            {data?.installations.length === 0 && (
              <Empty className="empty-card">
                <EmptyHeader>
                  <EmptyTitle>No repositories connected yet</EmptyTitle>
                  <EmptyDescription>Install the GitHub App and pick the repos the bot may watch.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <a href={INSTALL_URL}>Install GitHub App</a>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
            {data &&
              groupByInstallation(data).map((group) => (
                <InstallationCard key={group.installation.id} group={group} events={events} />
              ))}
            {/* Hidden for now: "Add another account or organization" prompt.
            {data && data.installations.length > 0 && (
              <div className="add-account">
                <span className="add-account-icon">
                  <Plus />
                </span>
                <div className="add-account-text">
                  <span className="add-account-title">Add another account or organization</span>
                  <span className="add-account-note">
                    You'll pick repos on GitHub, then land back here. Only accounts you own can be connected.
                  </span>
                </div>
                <Button variant="outline" size="sm" className="add-account-action" asChild>
                  <a href={INSTALL_URL}>Install GitHub App</a>
                </Button>
              </div>
            )} */}
          </div>
          <aside className="repos-side">
            <AppDetails data={app.data} error={app.error} />
          </aside>
        </div>
      </div>
    </>
  )
}
