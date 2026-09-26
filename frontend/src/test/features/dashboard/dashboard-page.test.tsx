import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { fetchEvents, fetchStats } from '@/features/events/api'
import type { Stats } from '@/features/events/schemas'
import { fetchRepositories } from '@/features/repositories/api'
import { fetchRules } from '@/features/rules/api'
import { eventItem, repositories, rule } from '../../fixtures'

vi.mock('@/features/events/api', () => ({ fetchEvents: vi.fn(), fetchStats: vi.fn(), fetchEventDetail: vi.fn() }))
vi.mock('@/features/repositories/api', () => ({ fetchRepositories: vi.fn() }))
vi.mock('@/features/rules/api', () => ({ fetchRules: vi.fn() }))

const stats: Stats = {
  events: 12,
  eventsPrevious: 10,
  actionsSucceeded: 9,
  actionsFailed: 1,
  actionsByType: { add_label: 4, add_comment: 2, slack_notify: 3 },
  jobsDead: 1,
  jobs: { pending: 0, retrying: 2, dead: 1, succeeded: 11 },
  recoveredDeliveries: 0,
  webhook: { configured: true, lastDeliveryAt: '2026-09-26T12:00:00.000Z' },
}

function renderDashboard(url = '/?repo=42') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <DashboardPage />
    </MemoryRouter>,
  )
}

const card = (label: string) => screen.getByText(label).closest('.stat-card') as HTMLElement

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchStats).mockResolvedValue(stats)
    vi.mocked(fetchRepositories).mockResolvedValue(repositories)
    vi.mocked(fetchRules).mockResolvedValue([rule(), rule({ id: 'r-2', repositoryId: '43' }), rule({ id: 'r-3', enabled: false })])
    vi.mocked(fetchEvents).mockResolvedValue({
      items: [
        eventItem(2, { actions: [{ type: 'add_label', status: 'succeeded', labels: ['bug'] }, { type: 'slack_notify', status: 'succeeded', labels: null }] }),
        eventItem(1, { actions: [] }),
      ],
      nextCursor: null,
      total: 2,
    })
  })

  it('shows the four stat cards for the filtered repo', async () => {
    renderDashboard()
    expect(await screen.findByText('12')).toBeTruthy()
    expect(vi.mocked(fetchStats).mock.calls[0][0]).toBe('42')
    expect(within(card('Events received')).getByText('+2')).toBeTruthy()
    expect(within(card('Actions taken')).getByText('4 labels · 2 comments · 3 Slack')).toBeTruthy()
    expect(within(card('Failed jobs')).getByText('3')).toBeTruthy()
    expect(within(card('Failed jobs')).getByText('2 retrying · 1 dead-lettered')).toBeTruthy()
    expect(card('Failed jobs').getAttribute('href')).toBe('/failures?repo=42')
    expect(await within(card('Active rules')).findByText('/ 3', { exact: false })).toBeTruthy()
    expect(within(card('Active rules')).getByText('Across 2 repositories')).toBeTruthy()
    expect(card('Active rules').getAttribute('href')).toBe('/rules?repo=42')
    expect(vi.mocked(fetchRules).mock.calls[0][0]).toBe('42')
  })

  it('lists the latest events with action chips and short statuses', async () => {
    renderDashboard()
    expect(await screen.findByText('#2 bug: crash 2')).toBeTruthy()
    expect(vi.mocked(fetchEvents).mock.calls[0][0]).toEqual({ repositoryId: '42', limit: 6 })
    const table = within(screen.getByRole('table'))
    expect(table.getByText('label: bug')).toBeTruthy()
    expect(table.getByText('Slack')).toBeTruthy()
    expect(table.getByText('No rule matched')).toBeTruthy()
    expect(table.getByText('Recorded')).toBeTruthy()
    expect(table.getByText('Done')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View all' }).getAttribute('href')).toBe('/events?repo=42')
  })

  it('shows the job queue and actions by type, and links to the event log and new rule', async () => {
    renderDashboard()
    const queue = (await screen.findByRole('heading', { name: 'Job queue' })).closest('section') as HTMLElement
    expect(within(queue).getByText('11')).toBeTruthy()
    expect(within(queue).getByRole('link', { name: 'Failures' }).getAttribute('href')).toBe('/failures?repo=42')
    const label = screen.getByRole('meter', { name: 'Add label' })
    expect(label.getAttribute('aria-valuenow')).toBe('4')
    expect((label.firstElementChild as HTMLElement).style.width).toBe('100%')
    expect((screen.getByRole('meter', { name: 'Post comment' }).firstElementChild as HTMLElement).style.width).toBe('50%')
    expect(screen.getByRole('link', { name: 'Open event log' }).getAttribute('href')).toBe('/events?repo=42')
    expect(screen.getByRole('link', { name: 'New rule' }).getAttribute('href')).toBe('/rules/new?repo=42')
  })

  it('shows an error when stats fail to load', async () => {
    vi.mocked(fetchStats).mockRejectedValue(new Error('down'))
    renderDashboard('/')
    expect(await screen.findByText('Could not load stats.')).toBeTruthy()
  })
})
