import { timeAgo } from '@/lib/time'
import type { EventItem } from './schemas'

export function EventRow({ event: e }: { event: EventItem }) {
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
