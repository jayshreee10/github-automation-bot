import type { ActionStatus, JobSummary } from '@/features/events/schemas'

// Badge colours from the design: success (green), warn (amber), destructive (red), muted, outline.
export type Tone = 'success' | 'warn' | 'destructive' | 'muted' | 'outline'

export interface StatusText {
  tone: Tone
  text: string
}

// "issues.opened", "push": the event names users see in GitHub's docs and in rules.
export function eventKey(event: string, action: string | null): string {
  return action ? `${event}.${action}` : event
}

// What happened to one delivery, from its job and how many actions ran.
export function deliveryStatus(job: JobSummary | null, actionCount: number): StatusText {
  if (!job) return { tone: 'muted', text: 'Recorded' }
  switch (job.status) {
    case 'pending':
      return { tone: 'muted', text: 'Queued' }
    case 'running':
      return { tone: 'muted', text: 'Running' }
    case 'failed':
      return { tone: 'warn', text: `Retrying ${job.attempts}/${job.maxAttempts}` }
    case 'dead':
      return { tone: 'destructive', text: 'Dead' }
    case 'succeeded':
      if (actionCount === 0) return { tone: 'outline', text: 'No rule matched' }
      return { tone: 'success', text: `Done · ${actionCount} ${actionCount === 1 ? 'action' : 'actions'}` }
  }
}

export function actionTone(status: ActionStatus): Tone {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'destructive'
  if (status === 'skipped') return 'outline'
  return 'muted'
}
