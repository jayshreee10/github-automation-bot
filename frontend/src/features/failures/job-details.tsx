import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { ACTION_NAMES } from '@/lib/labels'
import { clockTime, shortUntil } from '@/lib/time'
import { actionStatusText, failureKind, jobStatusText, lastError } from './failure-view'
import type { Failure } from './schemas'

// Selected failure: job state on the left, every action of the delivery on the right.
export function JobDetails({ failure, search }: { failure: Failure; search: string }) {
  const status = jobStatusText(failure)
  const error = lastError(failure)
  const params = new URLSearchParams(search)
  params.set('delivery', failure.deliveryId)

  return (
    <div className="failure-details">
      <section className="panel panel-padded" aria-label="Job details">
        <div className="failure-details-head">
          <h2 className="section-title">Job details</h2>
          <span className="mono failure-meta">delivery {failure.deliveryId.slice(0, 8)}</span>
        </div>
        <div>
          <div className="kv">
            <span className="kv-key">Status</span>
            <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
          </div>
          <div className="kv">
            <span className="kv-key">Attempts</span>
            <span>
              {failure.attempts} of {failure.maxAttempts}
            </span>
          </div>
          <div className="kv">
            <span className="kv-key">Last error</span>
            <span className="failure-kv-error">{error ?? '—'}</span>
          </div>
          <div className="kv">
            <span className="kv-key">Next run</span>
            <span>
              {failureKind(failure) === 'retrying'
                ? `${clockTime(failure.nextRunAt)} (${shortUntil(failure.nextRunAt)})`
                : 'Waiting for you'}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="failure-open-event" asChild>
          <Link to={{ pathname: '/events', search: `?${params}` }}>
            Open event
            <ExternalLink />
          </Link>
        </Button>
      </section>

      <section className="panel panel-padded" aria-label="Actions for this delivery">
        <h2 className="section-title">Actions for this delivery</h2>
        <div>
          {failure.actions.length === 0 && <p className="page-subtitle">No actions ran for this delivery.</p>}
          {failure.actions.map((a) => {
            const s = actionStatusText(a)
            return (
              <div key={a.id} className="kv">
                <span className="failure-action-name">
                  {ACTION_NAMES[a.type] ?? a.type}
                  <span className="failure-rule">{a.ruleName}</span>
                </span>
                <StatusBadge tone={s.tone} title={s.text}>
                  <span className="failure-error-text">{s.text}</span>
                </StatusBadge>
              </div>
            )
          })}
        </div>
        <p className="failure-note">
          Backoff grows 4× each attempt (30 s, 2 min, 8 min, 32 min). After {failure.maxAttempts} failures the job moves to
          Dead.
        </p>
      </section>
    </div>
  )
}
