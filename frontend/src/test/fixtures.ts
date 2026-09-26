import type { EventItem } from '@/features/events/schemas'
import type { Failure } from '@/features/failures/schemas'
import type { RepositoryList } from '@/features/repositories/schemas'
import type { Rule } from '@/features/rules/schemas'

export function eventItem(n: number, overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: `d-${n}`,
    event: 'issues',
    action: 'opened',
    repository: { id: '42', fullName: 'acme/api' },
    summary: { title: `bug: crash ${n}`, number: n, url: `https://github.com/acme/api/issues/${n}`, author: 'alice', ref: null },
    job: { id: `j-${n}`, status: 'succeeded', attempts: 1, maxAttempts: 5 },
    actions: [{ type: 'add_label', status: 'succeeded', labels: ['bug'] }],
    receivedAt: new Date(Date.UTC(2026, 8, 26, 12, n)).toISOString(),
    ...overrides,
  }
}

export function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r-1',
    repositoryId: '42',
    name: 'Label bugs',
    event: 'issues',
    conditions: {
      match: 'all',
      titleContains: ['bug'],
      bodyContains: [],
      authors: [],
      excludeAuthors: [],
      labels: [],
      branches: [],
    },
    actions: [{ type: 'add_label', labels: ['bug'] }, { type: 'slack_notify' }],
    enabled: true,
    firedCount: 0,
    lastFiredAt: null,
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
    ...overrides,
  }
}

export function failure(overrides: Partial<Failure> = {}): Failure {
  return {
    jobId: 'j-1',
    deliveryId: 'd-1',
    event: 'issues',
    action: 'opened',
    repository: { id: '42', fullName: 'acme/api' },
    summary: { title: 'bug: crash', number: 1, url: 'https://github.com/acme/api/issues/1', author: 'alice', ref: null },
    status: 'succeeded',
    attempts: 1,
    maxAttempts: 5,
    lastError: null,
    nextRunAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
    actions: [
      { id: 'a-0', type: 'add_label', ruleName: 'Label bugs', status: 'succeeded', attempts: 1, error: null },
      { id: 'a-1', type: 'slack_notify', ruleName: 'Label bugs', status: 'failed', attempts: 1, error: 'Slack webhook 404' },
    ],
    retryable: true,
    ...overrides,
  }
}

type Repository = RepositoryList['repositories'][number]

export function repository(overrides: Partial<Repository> = {}): Repository {
  return {
    id: '42',
    fullName: 'acme/api',
    isPrivate: false,
    defaultBranch: 'main',
    installationId: '1',
    accountLogin: 'acme',
    ruleCount: 0,
    lastEventAt: null,
    ...overrides,
  }
}

export const repositories: RepositoryList = {
  installations: [{ id: '1', accountLogin: 'acme', accountType: 'User', repositorySelection: 'selected' }],
  repositories: [repository(), repository({ id: '43', fullName: 'acme/web', isPrivate: true })],
}
