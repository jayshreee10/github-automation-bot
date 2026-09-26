import { EventRow } from './event-row'
import { useEventLog } from './use-event-log'
import { webhookState } from './webhook-state'

// Webhook status plus the latest events; refreshes itself while the tab is visible.
export function EventLog() {
  const { data, error } = useEventLog()
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
