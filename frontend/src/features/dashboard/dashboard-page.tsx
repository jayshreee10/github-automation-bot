import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useStats } from '@/features/events/use-stats'
import { TopBar } from '@/features/shell/top-bar'
import { useRepoFilter } from '@/features/shell/use-repo-filter'
import { LiveActivity } from './live-activity'
import { ActionsByType, JobQueue } from './queue-panels'
import { StatCards } from './stat-cards'
import { useRuleCounts } from './use-rule-counts'

export const DASHBOARD_POLL_MS = 5_000

export function DashboardPage() {
  const { repoId, search } = useRepoFilter()
  const { data: stats, error } = useStats(repoId, DASHBOARD_POLL_MS)
  const rules = useRuleCounts(repoId)

  return (
    <>
      <TopBar crumbs={[{ label: 'Workspace' }, { label: 'Dashboard' }]} live repoFilter />
      <div className="page">
        <div className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">Everything the bot received and did in the last 24 hours.</p>
          </div>
          <div className="page-head-actions">
            <Button variant="outline" asChild>
              <Link to={{ pathname: '/events', search }}>Open event log</Link>
            </Button>
            <Button asChild>
              <Link to={{ pathname: '/rules/new', search }}>
                <Plus />
                New rule
              </Link>
            </Button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        <StatCards stats={stats} rules={rules} search={search} />

        <div className="dashboard-grid">
          <LiveActivity repoId={repoId} search={search} />
          <div className="dashboard-side">
            {stats ? (
              <>
                <JobQueue stats={stats} search={search} />
                <ActionsByType stats={stats} />
              </>
            ) : (
              <Skeleton className="side-skeleton" />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
