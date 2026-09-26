import { describe, expect, it } from 'vitest'
import { actionStatusText, erroredActions, failureKind, jobStatusText, lastError, matchesTab } from '@/features/failures/failure-view'
import type { Failure } from '@/features/failures/schemas'
import { failure } from '../../fixtures'

const item = (overrides: Partial<Failure> = {}): Failure => ({ ...failure(), maxAttempts: 5, ...overrides })
const action = (status: Failure['actions'][number]['status'], error: string | null = null) => ({
  id: `a-${status}`,
  type: 'slack_notify' as const,
  ruleName: 'Bugs',
  status,
  attempts: 1,
  error,
})

describe('failure view', () => {
  it('classifies retrying, dead and finished-with-failed-action jobs', () => {
    expect(failureKind(item({ status: 'failed' }))).toBe('retrying')
    expect(failureKind(item({ status: 'dead' }))).toBe('dead')
    expect(failureKind(item())).toBe('action-failed')
    expect(failureKind(item({ status: 'running', actions: [] }))).toBe('other')
    expect(jobStatusText(item({ status: 'failed' }))).toEqual({ tone: 'warn', text: 'Retrying' })
  })

  it('filters tabs: all keeps everything, retrying and dead match the job status', () => {
    const f = item({ status: 'failed' })
    expect(matchesTab(f, 'all')).toBe(true)
    expect(matchesTab(f, 'retrying')).toBe(true)
    expect(matchesTab(f, 'dead')).toBe(false)
  })

  it('prefers an action error over the job error, including pending actions awaiting a retry', () => {
    const f = item({ status: 'failed', lastError: 'job', actions: [action('succeeded'), action('pending', 'Slack webhook 503')] })
    expect(erroredActions(f).map((a) => a.status)).toEqual(['pending'])
    expect(lastError(f)).toBe('Slack webhook 503')
    expect(lastError(item({ actions: [], lastError: 'Error: GitHub 502' }))).toBe('Error: GitHub 502')
  })

  it('describes each action of the delivery', () => {
    expect(actionStatusText(action('succeeded')).text).toBe('Done · skipped on retry')
    expect(actionStatusText(action('pending', 'Slack webhook 503'))).toEqual({ tone: 'warn', text: 'Pending retry' })
    expect(actionStatusText(action('failed', 'Slack webhook 404')).text).toBe('Failed · Slack webhook 404')
    expect(actionStatusText(action('pending')).text).toBe('Pending')
  })
})
