import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { type EventItem, type EventLog as Data, eventLogSchema } from '@/lib/schemas'
import { timeAgo } from '@/lib/time'

const POLL_MS = 5_000

type WebhookState = 'connected' | 'waiting' | 'off' | 'unknown'

function webhookState(webhook: Data['webhook']): { state: WebhookState; label: string } {
  if (webhook.configured === false) return { state: 'off', label: 'Webhook not configured' }
  if (webhook.configured === null) return { state: 'unknown', label: 'Webhook status unknown' }
  if (!webhook.lastDeliveryAt) return { state: 'waiting', label: 'Webhook configured · no events yet' }
  return { state: 'connected', label: `Webhook connected · last event ${timeAgo(webhook.lastDeliveryAt)}` }
}

// Short polling: refresh every 5 s while the tab is visible, so new GitHub events appear without a reload.
export function EventLog() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    // Always fetches once on mount; after that, hidden tabs skip polls until they are shown again.
    async function load(force = false) {
      clearTimeout(timer)
      if (force || !document.hidden) {
        try {
          const body = await apiFetch('/events?limit=20', eventLogSchema)
          if (!cancelled) {
            setData(body)
            setError(null)
          }
        } catch {
          if (!cancelled) setError('Could not load events.')
        }
      }
      if (!cancelled) timer = setTimeout(load, POLL_MS)
    }

    const onVisible = () => {
      if (!document.hidden) load()
    }
    load(true)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const status = data && webhookState(data.webhook)

  return (
    <section className="events-section">
      <header className="events-header">
        <h2 className="section-title">Recent events</h2>
        {status && (
          <span className="webhook-status" data-state={status.state}>
            <span className="webhook-dot" />
            {status.label}
          </span>
        )}
      </header>

      {error && <p className="error-text">{error}</p>}
      {data === null && !error && <p className="muted-text">Loading…</p>}
      {data?.events.length === 0 && (
        <p className="muted-text">No events yet. Open an issue or pull request on a connected repository.</p>
      )}

      {data && data.events.length > 0 && (
        <ul className="event-list">
          {data.events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </section>
  )
}

function EventRow({ event: e }: { event: EventItem }) {
  const type = e.action ? `${e.event}.${e.action}` : e.event
  const title = e.title || '(no title)'
  return (
    <li className="event-item">
      <div className="event-row">
        <div className="event-main">
          <span className="event-type">{type}</span>
          {e.url ? (
            <a className="event-title" href={e.url} target="_blank" rel="noreferrer">
              {title}
            </a>
          ) : (
            <span className="event-title">{title}</span>
          )}
        </div>
        <span className="event-status" data-status={e.status}>
          {e.status}
          {e.attempts > 1 && ` · ${e.attempts} attempts`}
        </span>
      </div>
      <p className="event-meta">
        {e.repository} · <time title={e.receivedAt}>{timeAgo(e.receivedAt)}</time>
      </p>
      {e.lastError && (e.status === 'failed' || e.status === 'dead') && (
        <p className="event-error">{e.lastError}</p>
      )}
    </li>
  )
}
