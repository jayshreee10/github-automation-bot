import { StatusBadge } from '@/components/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { deliveryStatus, eventKey } from '@/lib/status'
import { clockTime } from '@/lib/time'
import { EventSubject } from './event-subject'
import { authorHandle, repoShortName } from './event-text'
import type { EventItem } from './schemas'

interface Props {
  events: EventItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// Whole row is clickable; the subject is a real button so keyboard users can select too.
export function EventLogTable({ events, selectedId, onSelect }: Props) {
  return (
    <div className="panel data-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="cell-end">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((e) => {
            const status = deliveryStatus(e.job, e.actions.length)
            const detail = [repoShortName(e.repository.fullName), authorHandle(e.summary.author)].filter(Boolean).join(' · ')
            return (
              <TableRow
                key={e.id}
                className="event-row"
                data-selected={e.id === selectedId}
                onClick={() => onSelect(e.id)}
              >
                <TableCell>
                  <span className="mono">{eventKey(e.event, e.action)}</span>
                </TableCell>
                <TableCell className="subject-cell">
                  <button
                    type="button"
                    className="row-select"
                    aria-pressed={e.id === selectedId}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onSelect(e.id)
                    }}
                  >
                    <EventSubject summary={e.summary} detail={detail} />
                  </button>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
                </TableCell>
                <TableCell className="cell-end cell-time">
                  <time dateTime={e.receivedAt} title={e.receivedAt}>
                    {clockTime(e.receivedAt)}
                  </time>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
