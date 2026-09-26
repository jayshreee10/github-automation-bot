import type { StatusText } from '@/lib/status'
import type { Failure } from './schemas'

export type FailureTab = 'all' | 'retrying' | 'dead'
export type FailureAction = Failure['actions'][number]

// A failed job waits for its next try; dead waits for the user; a finished job can still hold a failed action.
export function failureKind(f: Failure): 'retrying' | 'dead' | 'action-failed' | 'other' {
  if (f.status === 'failed') return 'retrying'
  if (f.status === 'dead') return 'dead'
  if (f.actions.some((a) => a.status === 'failed')) return 'action-failed'
  return 'other'
}

export function matchesTab(f: Failure, tab: FailureTab): boolean {
  return tab === 'all' || failureKind(f) === tab
}

export function jobStatusText(f: Failure): StatusText {
  switch (failureKind(f)) {
    case 'retrying':
      return { tone: 'warn', text: 'Retrying' }
    case 'dead':
      return { tone: 'destructive', text: 'Dead' }
    case 'action-failed':
      return { tone: 'destructive', text: 'Action failed' }
    default:
      return { tone: 'muted', text: f.status }
  }
}

// Actions with an error: failed for good, or pending with the error that will be retried.
export function erroredActions(f: Failure): FailureAction[] {
  return f.actions.filter((a) => a.error !== null && a.status !== 'succeeded')
}

export function lastError(f: Failure): string | null {
  return erroredActions(f)[0]?.error ?? f.lastError
}

export function actionStatusText(a: FailureAction): StatusText {
  if (a.status === 'succeeded') return { tone: 'success', text: 'Done · skipped on retry' }
  if (a.status === 'failed') return { tone: 'destructive', text: a.error ? `Failed · ${a.error}` : 'Failed' }
  if (a.status === 'skipped') return { tone: 'outline', text: 'Skipped' }
  return a.error ? { tone: 'warn', text: 'Pending retry' } : { tone: 'muted', text: 'Pending' }
}
