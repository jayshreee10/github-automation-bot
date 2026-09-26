import { Skeleton } from '@/components/ui/skeleton'
import type { Stats } from '@/features/events/schemas'

// recoveredDeliveries is read loosely: it only appears once the shared stats schema declares it.
function recovered(stats: Stats | null): number | undefined {
  const value = (stats as (Stats & { recoveredDeliveries?: unknown }) | null)?.recoveredDeliveries
  return typeof value === 'number' ? value : stats ? 0 : undefined
}

// Current retrying/dead totals and deliveries the catch-up job recovered in the last 24 hours.
export function FailureTiles({ stats }: { stats: Stats | null }) {
  const tiles = [
    { label: 'Retrying', value: stats?.jobs.retrying, tone: undefined },
    { label: 'Dead', value: stats?.jobs.dead, tone: 'destructive' },
    { label: 'Missed deliveries caught up', value: recovered(stats), tone: undefined, hint: 'last 24 hours' },
  ]
  return (
    <div className="failure-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="panel failure-tile">
          <span className="failure-tile-label">
            {t.label}
            {t.hint && <span className="failure-tile-hint"> · {t.hint}</span>}
          </span>
          {t.value === undefined ? (
            <Skeleton className="failure-tile-skeleton" />
          ) : (
            <span className="failure-tile-value" data-tone={t.value > 0 ? t.tone : undefined}>
              {t.value}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
