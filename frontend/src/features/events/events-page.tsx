import { Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { type Segment, Segmented } from '@/components/segmented'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TopBar } from '@/features/shell/top-bar'
import { useRepoFilter } from '@/features/shell/use-repo-filter'
import { EventDetailPanel } from './event-detail-panel'
import { EventLogTable } from './event-log-table'
import type { JobStatus } from './schemas'
import { type EventFilters, PAGE_SIZE, useEventLog } from './use-event-log'

const SEARCH_DEBOUNCE_MS = 300
const DELIVERY = /^[0-9a-f-]{36}$/i

type EventType = 'all' | 'issues' | 'pull_request' | 'push'
const TYPES: Segment<EventType>[] = [
  { value: 'all', label: 'All' },
  { value: 'issues', label: 'Issues' },
  { value: 'pull_request', label: 'Pull requests' },
  { value: 'push', label: 'Push' },
]

const ANY = 'any'
const STATUSES: { value: JobStatus; label: string }[] = [
  { value: 'succeeded', label: 'Done' },
  { value: 'failed', label: 'Retrying' },
  { value: 'dead', label: 'Dead' },
  { value: 'pending', label: 'Queued' },
  { value: 'running', label: 'Running' },
]

// Selected event lives in ?delivery=, next to ?repo=, so reloads and shared links reopen it.
function useSelectedDelivery() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('delivery')
  const selected = raw && DELIVERY.test(raw) ? raw : null
  const select = useCallback(
    (id: string | null) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('delivery', id)
        else next.delete('delivery')
        return next
      }),
    [setParams],
  )
  return { selected, select }
}

export function EventsPage() {
  const { repoId } = useRepoFilter()
  const { selected, select } = useSelectedDelivery()
  const [searchText, setSearchText] = useState('')
  const [q, setQ] = useState('')
  const [type, setType] = useState<EventType>('all')
  const [status, setStatus] = useState<JobStatus | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchText.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchText])

  const filters: EventFilters = { repositoryId: repoId, event: type === 'all' ? null : type, status, q: q || null }

  return (
    <>
      <TopBar crumbs={[{ label: 'Workspace' }, { label: 'Event log' }]} live repoFilter />
      <div className="event-log">
        <div className="page event-log-main">
          <div className="page-head-text">
            <h1 className="page-title">Event log</h1>
            <p className="page-subtitle">Every webhook delivery, the rule it matched and what the bot did.</p>
          </div>
          <div className="event-toolbar">
            <label className="search-input event-search">
              <Search />
              <Input
                type="search"
                placeholder="Search title, author, delivery ID"
                aria-label="Search events"
                value={searchText}
                maxLength={100}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </label>
            <Segmented label="Event type" value={type} options={TYPES} onChange={setType} />
            <Select value={status ?? ANY} onValueChange={(v) => setStatus(v === ANY ? null : (v as JobStatus))}>
              <SelectTrigger size="sm" className="status-filter" aria-label="Status filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectItem value={ANY}>Status: any</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      Status: {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {/* key: any filter change starts again from page 1. */}
          <EventLogResults key={JSON.stringify(filters)} filters={filters} selected={selected} onSelect={select} />
        </div>
        {selected && <EventDetailPanel deliveryId={selected} onClose={() => select(null)} />}
      </div>
    </>
  )
}

interface ResultsProps {
  filters: EventFilters
  selected: string | null
  onSelect: (id: string) => void
}

function EventLogResults({ filters, selected, onSelect }: ResultsProps) {
  const { items, error, total, pageIndex, hasNext, hasPrevious, next, previous } = useEventLog(filters)
  const filtered = Boolean(filters.event || filters.status || filters.q)
  const start = pageIndex * PAGE_SIZE + 1

  return (
    <>
      {error && <p className="error-text">{error}</p>}
      {items === null && !error && <Skeleton className="table-skeleton" />}
      {items?.length === 0 && (
        <Empty className="empty-card">
          <EmptyHeader>
            <EmptyTitle>{filtered ? 'No matching events' : 'No events yet'}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? 'Try another search or clear the filters.'
                : 'Open an issue or pull request, or push a commit, on a connected repository.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {items && items.length > 0 && <EventLogTable events={items} selectedId={selected} onSelect={onSelect} />}
      {items && items.length > 0 && (
        <div className="event-pager">
          <span className="event-pager-text">
            Showing {start}–{start + items.length - 1}
            {total !== null && ` of ${total}`} events
          </span>
          <div className="event-pager-buttons">
            <Button variant="outline" size="sm" onClick={previous} disabled={!hasPrevious}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={next} disabled={!hasNext}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
