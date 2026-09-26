import { Copy, ExternalLink, MessageSquare, Send, ShieldCheck, Tag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRepoFilter } from '@/features/shell/use-repo-filter'
import { actionTone, deliveryStatus, eventKey } from '@/lib/status'
import { clockTime } from '@/lib/time'
import { fetchEventDetail } from './api'
import { authorHandle, conditionSegments, payloadExcerpt, repoShortName, rulesNotRunYet, subjectTitle } from './event-text'
import type { EventDetail } from './schemas'

type DetailAction = EventDetail['actions'][number]
type Job = NonNullable<EventDetail['job']>

const JOB_WORDS: Record<Job['status'], string> = {
  pending: 'Queued',
  running: 'Running',
  succeeded: 'Done',
  failed: 'Retrying',
  dead: 'Dead',
}

function jobText(job: Job): string {
  const attempts = `${job.attempts} ${job.attempts === 1 ? 'attempt' : 'attempts'}`
  return job.status === 'failed' ? `Retrying · attempt ${job.attempts} of ${job.maxAttempts}` : `${JOB_WORDS[job.status]} · ${attempts}`
}

const ICONS = { add_label: Tag, add_comment: MessageSquare, slack_notify: Send, ai_triage: Send }

// Only GitHub links the API vouched for are rendered as links.
const githubUrl = (value: unknown) => (typeof value === 'string' && value.startsWith('https://github.com/') ? value : null)

function ActionTitle({ action }: { action: DetailAction }) {
  const done = action.status === 'succeeded'
  if (action.type === 'add_label') {
    const labels = Array.isArray(action.result?.labels) ? action.result.labels.filter((l) => typeof l === 'string') : []
    return (
      <span className="action-title">
        {done ? 'Added label' : 'Add label'}
        {labels.map((l) => (
          <span key={l} className="chip action-title-chip">
            {l}
          </span>
        ))}
      </span>
    )
  }
  if (action.type === 'add_comment') {
    const url = githubUrl(action.result?.url)
    const text = done ? 'Posted comment' : 'Post comment'
    return url ? (
      <a className="action-title" href={url} target="_blank" rel="noreferrer">
        {text}
      </a>
    ) : (
      <span className="action-title">{text}</span>
    )
  }
  return <span className="action-title">{done ? 'Sent Slack notification' : 'Send Slack notification'}</span>
}

const ACTION_STATUS: Record<DetailAction['status'], string> = {
  succeeded: 'Succeeded',
  failed: 'Failed',
  pending: 'Pending',
  skipped: 'Skipped',
}

function ActionRow({ action }: { action: DetailAction }) {
  const Icon = ICONS[action.type]
  const waiting = action.status === 'pending' && action.error
  return (
    <li className="action-row">
      <span className="action-icon" data-tone={actionTone(action.status)}>
        <Icon />
      </span>
      <div className="action-body">
        <div className="action-line">
          <ActionTitle action={action} />
          {action.durationMs !== null && <span className="action-duration">{action.durationMs} ms</span>}
        </div>
        <span className="action-meta">
          {waiting ? 'Pending retry' : ACTION_STATUS[action.status]} · attempt {action.attempts} · {action.ruleName}
        </span>
        {action.error && <span className="action-error">{action.error}</span>}
      </div>
    </li>
  )
}

interface Props {
  deliveryId: string
  // Changes when the row's job changes, so an open panel refreshes as the job progresses.
  version?: string
  onClose: () => void
}

export function EventDetailPanel({ deliveryId, version, onClose }: Props) {
  const { search } = useRepoFilter()
  // Tagged with its id, so switching rows never shows the previous event.
  const [loaded, setLoaded] = useState<{ id: string; detail: EventDetail | null; error: string | null } | null>(null)
  const current = loaded?.id === deliveryId ? loaded : null
  const detail = current?.detail ?? null

  useEffect(() => {
    const controller = new AbortController()
    fetchEventDetail(deliveryId, controller.signal)
      .then((d) => setLoaded({ id: deliveryId, detail: d, error: null }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ id: deliveryId, detail: null, error: 'Could not load this event.' })
      })
    return () => controller.abort()
  }, [deliveryId, version])

  async function copyId() {
    try {
      await navigator.clipboard.writeText(deliveryId)
      toast.success('Delivery ID copied')
    } catch {
      toast.error('Could not copy the delivery ID')
    }
  }

  const status = detail && deliveryStatus(detail.job, detail.actions.length)
  const author = detail && authorHandle(detail.summary.author)

  return (
    <aside className="event-detail" aria-label="Event details">
      <div className="event-detail-head">
        <div className="event-detail-badges">
          {detail && <StatusBadge tone="outline">{eventKey(detail.event, detail.action)}</StatusBadge>}
          {detail && status && <StatusBadge tone={status.tone}>{detail.job ? JOB_WORDS[detail.job.status] : status.text}</StatusBadge>}
          <Button variant="ghost" size="icon-sm" className="event-detail-close" onClick={onClose} aria-label="Close details">
            <X />
          </Button>
        </div>
        {detail ? (
          <>
            <h2 className="event-detail-title">{subjectTitle(detail.summary)}</h2>
            <span className="event-detail-meta">
              {[
                repoShortName(detail.repository.fullName),
                author && `${detail.event === 'push' ? 'pushed' : detail.action ?? 'sent'} by ${author}`,
                clockTime(detail.receivedAt),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </>
        ) : (
          !current?.error && <Skeleton className="event-detail-skeleton" />
        )}
        {current?.error && <p className="error-text">{current.error}</p>}
      </div>

      {detail && (
        <div className="event-detail-body">
          <section className="detail-section">
            <span className="detail-label">Delivery</span>
            <div className="kv">
              <span className="kv-key">Delivery ID</span>
              <span className="mono">{detail.id}</span>
            </div>
            <div className="kv">
              <span className="kv-key">Signature</span>
              <span className="signature-ok">
                <ShieldCheck />
                Verified HMAC-SHA256
              </span>
            </div>
            <div className="kv">
              <span className="kv-key">Received</span>
              <span>{clockTime(detail.receivedAt)}</span>
            </div>
            <div className="kv">
              <span className="kv-key">Job</span>
              <span>{detail.job ? jobText(detail.job) : 'No job recorded'}</span>
            </div>
            {detail.job?.lastError && detail.job.status !== 'succeeded' && (
              <div className="kv">
                <span className="kv-key">Last error</span>
                <span className="action-error">{detail.job.lastError}</span>
              </div>
            )}
          </section>

          <section className="detail-section">
            <span className="detail-label">{detail.rules.length > 1 ? 'Rules matched' : 'Rule matched'}</span>
            {detail.rules.length === 0 && (
              <p className="muted-text">
                {rulesNotRunYet(detail.job) ? 'Rules run once the job succeeds.' : 'No rule matched this event.'}
              </p>
            )}
            {detail.rules.map((rule) => (
              <div key={rule.id} className="rule-match">
                <div className="rule-match-head">
                  <span className="rule-match-name">{rule.name}</span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={{ pathname: `/rules/${rule.id}`, search }}>Edit rule</Link>
                  </Button>
                </div>
                <span className="rule-match-conditions">
                  {conditionSegments(rule.conditions).map((s, i) =>
                    s.value ? (
                      <span key={i} className="rule-match-value">
                        {s.text}
                      </span>
                    ) : (
                      <span key={i}>{s.text}</span>
                    ),
                  )}
                </span>
              </div>
            ))}
          </section>

          {detail.actions.length > 0 && (
            <section className="detail-section">
              <span className="detail-label">Actions taken</span>
              <ul className="action-list">
                {detail.actions.map((a) => (
                  <ActionRow key={a.id} action={a} />
                ))}
              </ul>
            </section>
          )}

          <section className="detail-section">
            <span className="detail-label">Payload excerpt</span>
            <pre className="payload-excerpt">{payloadExcerpt(detail)}</pre>
          </section>
        </div>
      )}

      <div className="event-detail-foot">
        {detail?.summary.url && (
          <Button variant="outline" size="sm" asChild>
            <a href={detail.summary.url} target="_blank" rel="noreferrer">
              <ExternalLink />
              View on GitHub
            </a>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={copyId}>
          <Copy />
          Copy delivery ID
        </Button>
      </div>
    </aside>
  )
}
