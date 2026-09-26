import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ACTION_NAMES } from '@/lib/labels'
import { eventKey } from '@/lib/status'
import { shortUntil } from '@/lib/time'
import { ActionIcon } from './action-icon'
import { erroredActions, failureKind, lastError } from './failure-view'
import type { Failure } from './schemas'

interface Props {
  failures: Failure[]
  selectedId: string | null
  retrying: Set<string>
  onSelect: (jobId: string) => void
  onRetry: (failure: Failure) => void
}

function nextTry(f: Failure): string {
  const kind = failureKind(f)
  if (kind === 'retrying') return shortUntil(f.nextRunAt)
  return kind === 'dead' ? 'Dead' : '—'
}

export function FailureTable({ failures, selectedId, retrying, onSelect, onRetry }: Props) {
  return (
    <div className="panel data-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Last error</TableHead>
            <TableHead className="failure-attempts-head">Attempts</TableHead>
            <TableHead>Next try</TableHead>
            <TableHead>
              <span className="visually-hidden">Retry</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {failures.map((f) => {
            const [first, ...more] = erroredActions(f)
            const error = lastError(f)
            const percent = Math.min(100, Math.round((f.attempts / f.maxAttempts) * 100))
            return (
              <TableRow
                key={f.jobId}
                className="failure-row"
                data-selected={f.jobId === selectedId}
                onClick={() => onSelect(f.jobId)}
              >
                <TableCell>
                  <span className="failure-action">
                    <ActionIcon type={first?.type ?? null} />
                    {first ? (ACTION_NAMES[first.type] ?? first.type) : 'Job'}
                    {more.length > 0 && <span className="failure-more">+{more.length} more</span>}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="failure-event">
                    <span className="failure-title">
                      {f.summary.number ? `#${f.summary.number} ` : ''}
                      {f.summary.title ?? '(no title)'}
                    </span>
                    <span className="mono failure-meta">
                      {eventKey(f.event, f.action)} · {f.deliveryId.slice(0, 8)}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  {error ? (
                    <StatusBadge tone="destructive" title={error}>
                      <span className="failure-error-text">{error}</span>
                    </StatusBadge>
                  ) : (
                    <span className="page-subtitle">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="failure-attempts">
                    <span className="progress" aria-hidden>
                      <span className="progress-bar failure-progress" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="failure-attempts-text">
                      {f.attempts} / {f.maxAttempts}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="failure-next">{nextTry(f)}</TableCell>
                <TableCell className="failure-retry-cell">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!f.retryable || retrying.has(f.jobId)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRetry(f)
                    }}
                  >
                    {retrying.has(f.jobId) ? 'Retrying…' : 'Retry now'}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
