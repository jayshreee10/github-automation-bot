import { CircleCheck } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EVENT_NOTES, permissionRows } from './app-info'
import type { AppInfo } from './schemas'

interface Props {
  data: AppInfo | null
  error: boolean
}

// Right column: what the App may do and which webhooks it receives, straight from GitHub.
export function AppDetails({ data, error }: Props) {
  return (
    <>
      <section className="panel panel-padded" aria-labelledby="app-permissions">
        <h2 id="app-permissions" className="section-title">
          App permissions
        </h2>
        <p className="app-details-note">What the bot can do in connected repos.</p>
        {error && <p className="app-details-note">Could not load app details.</p>}
        {!data && !error && <Skeleton className="app-details-skeleton" />}
        {data && (
          <div>
            {permissionRows(data.permissions).map((p) => (
              <div key={p.key} className="kv">
                <span>{p.name}</span>
                <StatusBadge tone={p.tone}>{p.access}</StatusBadge>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel panel-padded" aria-labelledby="app-events">
        <h2 id="app-events" className="section-title">
          Subscribed events
        </h2>
        {error && <p className="app-details-note">Could not load app details.</p>}
        {!data && !error && <Skeleton className="app-details-skeleton" />}
        {data && (
          <ul className="event-list">
            {data.events.map((e) => (
              <li key={e} className="event-list-item">
                <CircleCheck />
                <span className="mono">{e}</span>
                <span className="event-list-note">{EVENT_NOTES[e] ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
