import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventRow } from './event-row'
import type { EventItem } from './schemas'

const base: EventItem = {
  id: 'd-1',
  event: 'issues',
  action: 'opened',
  repository: 'acme/api',
  title: 'bug: crash',
  url: 'https://github.com/acme/api/issues/1',
  status: 'succeeded',
  attempts: 1,
  lastError: null,
  receivedAt: new Date().toISOString(),
}

const renderRow = (overrides: Partial<EventItem> = {}) =>
  render(
    <ul>
      <EventRow event={{ ...base, ...overrides }} />
    </ul>,
  )

describe('EventRow', () => {
  it('shows event.action, a link to GitHub, repo and relative time', () => {
    renderRow()
    expect(screen.getByText('issues.opened')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'bug: crash' }).getAttribute('href')).toBe(base.url)
    expect(screen.getByText(/acme\/api/)).toBeTruthy()
    expect(screen.getByText('just now').getAttribute('title')).toBe(base.receivedAt)
  })

  it('shows the bare event name and plain text without action or url', () => {
    renderRow({ event: 'push', action: null, url: null, title: null })
    expect(screen.getByText('push')).toBeTruthy()
    expect(screen.getByText('(no title)')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows attempts only after a retry', () => {
    renderRow({ attempts: 1 })
    expect(screen.queryByText(/attempts/)).toBeNull()
    renderRow({ id: 'd-2', status: 'pending', attempts: 3 })
    expect(screen.getByText('pending · 3 attempts')).toBeTruthy()
  })

  it.each(['failed', 'dead'] as const)('shows the last error for %s jobs', (status) => {
    renderRow({ status, lastError: 'GitHub API 502' })
    expect(screen.getByText('GitHub API 502')).toBeTruthy()
  })

  it('hides a stale error once the job succeeded', () => {
    renderRow({ status: 'succeeded', lastError: 'GitHub API 502' })
    expect(screen.queryByText('GitHub API 502')).toBeNull()
  })
})
