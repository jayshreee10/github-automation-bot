import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import type { Stats } from '@/features/events/schemas'
import type { RuleCounts } from './use-rule-counts'

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`

interface Props {
  stats: Stats | null
  rules: RuleCounts | null
  search: string
}

// The four headline numbers. Failed jobs and Active rules link to their pages.
export function StatCards({ stats, rules, search }: Props) {
  const delta = stats ? stats.events - stats.eventsPrevious : 0
  const failed = stats ? stats.jobs.retrying + stats.jobs.dead : 0

  return (
    <div className="stat-grid">
      <div className="panel stat-card">
        <span className="stat-label">Events received</span>
        <span className="stat-value">{stats ? stats.events : <Skeleton className="stat-skeleton" />}</span>
        {stats && (
          <span className="stat-note">
            <span className="stat-delta" data-trend={delta >= 0 ? 'up' : 'down'}>
              {delta >= 0 ? `+${delta}` : delta}
            </span>{' '}
            vs yesterday
          </span>
        )}
      </div>

      <div className="panel stat-card">
        <span className="stat-label">Actions taken</span>
        <span className="stat-value">{stats ? stats.actionsSucceeded : <Skeleton className="stat-skeleton" />}</span>
        {stats && (
          <span className="stat-note">
            {plural(stats.actionsByType.add_label, 'label')} · {plural(stats.actionsByType.add_comment, 'comment')} ·{' '}
            {stats.actionsByType.slack_notify} Slack
          </span>
        )}
      </div>

      <Link className="panel stat-card stat-link" to={{ pathname: '/failures', search }}>
        <span className="stat-label">Failed jobs</span>
        <span className="stat-value" data-alert={failed > 0}>
          {stats ? failed : <Skeleton className="stat-skeleton" />}
        </span>
        {stats && (
          <span className="stat-note">
            {stats.jobs.retrying} retrying · {stats.jobs.dead} dead-lettered
          </span>
        )}
      </Link>

      <Link className="panel stat-card stat-link" to={{ pathname: '/rules', search }}>
        <span className="stat-label">Active rules</span>
        <span className="stat-value">
          {rules ? (
            <>
              {rules.enabled}
              <span className="stat-of"> / {rules.total}</span>
            </>
          ) : (
            <Skeleton className="stat-skeleton" />
          )}
        </span>
        {rules && (
          <span className="stat-note">
            Across {rules.repositories} {rules.repositories === 1 ? 'repository' : 'repositories'}
          </span>
        )}
      </Link>
    </div>
  )
}
