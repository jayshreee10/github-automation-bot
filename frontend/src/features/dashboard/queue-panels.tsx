import { Link } from 'react-router'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import type { Stats } from '@/features/events/schemas'

export function JobQueue({ stats, search }: { stats: Stats; search: string }) {
  return (
    <section className="panel panel-padded" aria-labelledby="job-queue">
      <div className="queue-head">
        <h2 id="job-queue" className="section-title">
          Job queue
        </h2>
        <Button variant="ghost" size="sm" className="panel-head-actions" asChild>
          <Link to={{ pathname: '/failures', search }}>Failures</Link>
        </Button>
      </div>
      <div>
        <div className="kv">
          <span>Pending</span>
          <span className="kv-value">{stats.jobs.pending}</span>
        </div>
        <div className="kv">
          <span>Done</span>
          <span className="kv-value">{stats.jobs.succeeded}</span>
        </div>
        <div className="kv">
          <span>Retrying</span>
          <StatusBadge tone={stats.jobs.retrying ? 'warn' : 'muted'}>{stats.jobs.retrying}</StatusBadge>
        </div>
        <div className="kv">
          <span>Dead</span>
          <StatusBadge tone={stats.jobs.dead ? 'destructive' : 'muted'}>{stats.jobs.dead}</StatusBadge>
        </div>
      </div>
    </section>
  )
}

const BARS = [
  { key: 'add_label', label: 'Add label', colour: 'chart-1' },
  { key: 'slack_notify', label: 'Slack notification', colour: 'chart-2' },
  { key: 'add_comment', label: 'Post comment', colour: 'chart-4' },
] as const

// Bar widths are relative to the busiest type, so the largest bar is always full.
export function ActionsByType({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...BARS.map((b) => stats.actionsByType[b.key]))
  return (
    <section className="panel panel-padded actions-by-type" aria-labelledby="actions-by-type">
      <h2 id="actions-by-type" className="section-title">
        Actions by type
      </h2>
      <div className="bar-list">
        {BARS.map((b) => {
          const count = stats.actionsByType[b.key]
          return (
            <div key={b.key} className="bar-item">
              <div className="bar-label">
                <span>{b.label}</span>
                <span className="kv-value">{count}</span>
              </div>
              <div
                className="progress"
                role="meter"
                aria-label={b.label}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={count}
              >
                <span className="progress-bar" data-colour={b.colour} style={{ width: `${(count / max) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
