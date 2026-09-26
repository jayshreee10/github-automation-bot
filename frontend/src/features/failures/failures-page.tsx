import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Segmented } from '@/components/segmented'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useStats } from '@/features/events/use-stats'
import { TopBar } from '@/features/shell/top-bar'
import { useRepoFilter } from '@/features/shell/use-repo-filter'
import { useVisiblePolling } from '@/hooks/use-visible-polling'
import { ApiError } from '@/lib/api'
import { fetchFailures, retryJob } from './api'
import { FailureTable } from './failure-table'
import { FailureTiles } from './failure-tiles'
import { type FailureTab, matchesTab } from './failure-view'
import { JobDetails } from './job-details'
import type { Failure } from './schemas'

const FAILURES_POLL_MS = 10_000

export function FailuresPage() {
  const { repoId, search } = useRepoFilter()
  const load = useCallback((signal: AbortSignal) => fetchFailures(repoId, signal), [repoId])
  const { data, error, refresh } = useVisiblePolling(load, FAILURES_POLL_MS, 'Could not load failures.')
  const { data: stats, refresh: refreshStats } = useStats(repoId)
  const [tab, setTab] = useState<FailureTab>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<Set<string>>(new Set())

  const items = data?.items ?? []
  const visible = items.filter((f) => matchesTab(f, tab))
  const selected = visible.find((f) => f.jobId === selectedId) ?? visible[0] ?? null
  const count = (t: FailureTab) => items.filter((f) => matchesTab(f, t)).length

  async function retry(f: Failure) {
    setRetrying((prev) => new Set(prev).add(f.jobId))
    try {
      await retryJob(f.jobId)
      toast.success('Retry queued', { description: 'Only the failed actions run again.' })
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 409 ? 'Already queued or running' : 'Retry failed')
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev)
        next.delete(f.jobId)
        return next
      })
      refresh()
      refreshStats()
    }
  }

  return (
    <>
      <TopBar crumbs={[{ label: 'Workspace' }, { label: 'Failures' }]} repoFilter />
      <div className="page">
        <div className="page-head">
          <div className="page-head-text">
            <h1 className="page-title">Failures &amp; retries</h1>
            <p className="page-subtitle">Jobs that hit an error. Retries back off automatically; dead jobs wait for you.</p>
          </div>
        </div>

        <FailureTiles stats={stats} />

        {error && <p className="error-text">{error}</p>}
        {data === null && !error && <Skeleton className="table-skeleton" />}
        {data && items.length === 0 && (
          <Empty className="empty-card">
            <EmptyHeader>
              <EmptyTitle>Nothing has failed</EmptyTitle>
              <EmptyDescription>Every job and action finished successfully.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {items.length > 0 && (
          <>
            <Segmented
              label="Failure status"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'all', label: 'All', count: count('all') },
                { value: 'retrying', label: 'Retrying', count: count('retrying') },
                { value: 'dead', label: 'Dead', count: count('dead') },
              ]}
            />
            {visible.length === 0 ? (
              <p className="page-subtitle">Nothing in this tab.</p>
            ) : (
              <FailureTable
                failures={visible}
                selectedId={selected?.jobId ?? null}
                retrying={retrying}
                onSelect={setSelectedId}
                onRetry={retry}
              />
            )}
            {selected && <JobDetails failure={selected} search={search} />}
          </>
        )}
      </div>
    </>
  )
}
