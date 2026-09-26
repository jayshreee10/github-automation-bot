import { useCallback } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActionChips } from '@/features/events/action-chips'
import { fetchEvents } from '@/features/events/api'
import { EventSubject } from '@/features/events/event-subject'
import type { EventItem } from '@/features/events/schemas'
import { useVisiblePolling } from '@/hooks/use-visible-polling'
import { repoShortName } from '@/lib/repo-name'
import { deliveryStatus, eventKey, type StatusText } from '@/lib/status'
import { shortAge } from '@/lib/time'

export const ACTIVITY_POLL_MS = 5_000
export const ACTIVITY_LIMIT = 6

// Short form for the dashboard: the Actions column already says how many ran.
function activityStatus(e: EventItem): StatusText {
  const s = deliveryStatus(e.job, e.actions.length)
  if (s.text.startsWith('Done')) return { tone: 'success', text: 'Done' }
  if (s.text === 'No rule matched') return { tone: 'outline', text: 'Recorded' }
  return s
}

export function LiveActivity({ repoId, search }: { repoId: string | null; search: string }) {
  const load = useCallback(
    (signal: AbortSignal) => fetchEvents({ repositoryId: repoId, limit: ACTIVITY_LIMIT }, signal),
    [repoId],
  )
  const { data, error } = useVisiblePolling(load, ACTIVITY_POLL_MS, 'Could not load recent events.')

  return (
    <section className="panel activity-panel" aria-labelledby="live-activity">
      <div className="panel-head">
        <div className="panel-head-text">
          <h2 id="live-activity" className="section-title">
            Live activity
          </h2>
          <span className="page-subtitle">Newest first. Refreshes every 5s.</span>
        </div>
        <Button variant="ghost" size="sm" className="panel-head-actions" asChild>
          <Link to={{ pathname: '/events', search }}>View all</Link>
        </Button>
      </div>
      {error && <p className="error-text activity-message">{error}</p>}
      {!data && !error && <Skeleton className="activity-skeleton" />}
      {data?.items.length === 0 && (
        <p className="muted-text activity-message">No events yet. Open an issue or pull request on a connected repository.</p>
      )}
      {data && data.items.length > 0 && (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="cell-end">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((e) => {
                const status = activityStatus(e)
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className="mono">{eventKey(e.event, e.action)}</span>
                    </TableCell>
                    <TableCell className="subject-cell">
                      <EventSubject summary={e.summary} detail={repoShortName(e.repository.fullName)} />
                    </TableCell>
                    <TableCell>
                      <ActionChips actions={e.actions} job={e.job} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
                    </TableCell>
                    <TableCell className="cell-end cell-time">
                      <time dateTime={e.receivedAt} title={e.receivedAt}>
                        {shortAge(e.receivedAt)}
                      </time>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
