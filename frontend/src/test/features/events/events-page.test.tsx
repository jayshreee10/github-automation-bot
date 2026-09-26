import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchEventDetail, fetchEvents } from '@/features/events/api'
import { EventsPage } from '@/features/events/events-page'
import type { EventDetail } from '@/features/events/schemas'
import { useEventLog } from '@/features/events/use-event-log'
import { fetchRepositories } from '@/features/repositories/api'
import { eventItem, repositories } from '../../fixtures'

vi.mock('@/features/events/api', () => ({ fetchEvents: vi.fn(), fetchStats: vi.fn(), fetchEventDetail: vi.fn() }))
vi.mock('@/features/repositories/api', () => ({ fetchRepositories: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const item = (n: number) => eventItem(n, { id: ID(n) })

const detail: EventDetail = {
  ...item(1),
  job: { id: 'j-1', status: 'succeeded', attempts: 1, maxAttempts: 5, nextRunAt: '2026-09-26T12:00:00.000Z', lastError: null, updatedAt: '2026-09-26T12:00:00.000Z' },
  actions: [
    { id: 'a1', ruleId: 'r-1', ruleName: 'Bug reports', type: 'add_label', status: 'succeeded', attempts: 1, result: { labels: ['bug'] }, error: null, durationMs: 212, updatedAt: '2026-09-26T12:00:00.000Z' },
    { id: 'a2', ruleId: 'r-1', ruleName: 'Bug reports', type: 'slack_notify', status: 'pending', attempts: 2, result: null, error: 'Slack webhook 503', durationMs: null, updatedAt: '2026-09-26T12:00:00.000Z' },
  ],
  rules: [
    {
      id: 'r-1',
      name: 'Bug reports',
      event: 'issues',
      conditions: { match: 'all', titleContains: ['bug'], bodyContains: [], authors: [], excludeAuthors: ['dependabot[bot]'], labels: [], branches: [] },
    },
  ],
}

function LocationProbe() {
  return <output data-testid="search">{useLocation().search}</output>
}
const location = () => screen.getByTestId('search').textContent

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <EventsPage />
      <LocationProbe />
    </MemoryRouter>,
  )
}

const lastQuery = () => vi.mocked(fetchEvents).mock.calls.at(-1)?.[0]

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchRepositories).mockResolvedValue(repositories)
    vi.mocked(fetchEvents).mockResolvedValue({ items: [item(2), item(1)], nextCursor: 'c1', total: 30 })
    vi.mocked(fetchEventDetail).mockResolvedValue(detail)
  })

  it('loads the first page for the repo in the URL and shows the total', async () => {
    renderAt('/events?repo=42')
    expect(await screen.findByText('#2 bug: crash 2')).toBeTruthy()
    expect(lastQuery()).toEqual({ repositoryId: '42', event: null, status: null, q: null, before: null, limit: 25 })
    expect(screen.getByText('Showing 1–2 of 30 events')).toBeTruthy()
    expect(screen.getAllByText('Done · 1 action')).toHaveLength(2)
    expect(screen.getAllByText('api · @alice')).toHaveLength(2)
  })

  it('passes the event type and a debounced search to the API', async () => {
    renderAt('/events')
    await screen.findByText('#2 bug: crash 2')
    fireEvent.click(screen.getByRole('radio', { name: 'Push' }))
    await waitFor(() => expect(lastQuery()).toMatchObject({ event: 'push', q: null }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search events' }), { target: { value: '  crash ' } })
    await waitFor(() => expect(lastQuery()).toMatchObject({ event: 'push', q: 'crash', before: null }))
  })

  it('pages forward with the cursor and back by popping it', async () => {
    renderAt('/events')
    await screen.findByText('#2 bug: crash 2')
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true)

    vi.mocked(fetchEvents).mockResolvedValueOnce({ items: [item(3)], nextCursor: null, total: null })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('#3 bug: crash 3')).toBeTruthy()
    expect(lastQuery()).toMatchObject({ before: 'c1' })
    expect(screen.getByText('Showing 26–26 of 30 events')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('#2 bug: crash 2')).toBeTruthy()
    expect(lastQuery()).toMatchObject({ before: null })
  })

  it('opens the detail panel for a row and keeps the selection in the URL', async () => {
    renderAt('/events?repo=42')
    fireEvent.click(await screen.findByRole('button', { name: /#1 bug: crash 1/ }))
    expect(await screen.findByRole('complementary', { name: 'Event details' })).toBeTruthy()
    expect(location()).toBe(`?repo=42&delivery=${ID(1)}`)
    expect(vi.mocked(fetchEventDetail).mock.calls[0][0]).toBe(ID(1))

    expect(await screen.findByText('Bug reports')).toBeTruthy()
    expect(screen.getByText('"bug"')).toBeTruthy()
    expect(screen.getByText('dependabot[bot]')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Edit rule' }).getAttribute('href')).toBe('/rules/r-1?repo=42')
    expect(screen.getByText('Added label')).toBeTruthy()
    expect(screen.getByText('212 ms')).toBeTruthy()
    expect(screen.getByText('Slack webhook 503')).toBeTruthy()
    expect(screen.getByText(/Pending retry · attempt 2/)).toBeTruthy()
    expect(screen.getByText('Verified HMAC-SHA256')).toBeTruthy()
    expect(screen.getByText(/"full_name": "acme\/api"/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /View on GitHub/ }).getAttribute('href')).toBe('https://github.com/acme/api/issues/1')

    fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Event details' })).toBeNull())
    expect(location()).toBe('?repo=42')
  })

  it('reopens the panel from ?delivery= and copies the delivery id', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    renderAt(`/events?delivery=${ID(1)}`)
    await screen.findByText('Bug reports')
    fireEvent.click(screen.getByRole('button', { name: /Copy delivery ID/ }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Delivery ID copied'))
    expect(writeText).toHaveBeenCalledWith(ID(1))
  })

  it('says when no rule matched', async () => {
    vi.mocked(fetchEventDetail).mockResolvedValue({ ...detail, actions: [], rules: [] })
    renderAt(`/events?delivery=${ID(1)}`)
    expect(await screen.findByText('No rule matched this event.')).toBeTruthy()
  })

  it('renders titles as text, never as HTML', async () => {
    vi.mocked(fetchEvents).mockResolvedValue({
      items: [eventItem(1, { summary: { title: '<img src=x onerror=alert(1)>', number: null, url: null, author: null, ref: null } })],
      nextCursor: null,
      total: 1,
    })
    const { container } = renderAt('/events')
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('useEventLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchEvents).mockResolvedValue({ items: [item(1)], nextCursor: null, total: 1 })
  })

  it('passes every filter to the API', async () => {
    const { result } = renderHook(() => useEventLog({ repositoryId: '42', event: 'issues', status: 'dead', q: 'crash' }))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(lastQuery()).toEqual({ repositoryId: '42', event: 'issues', status: 'dead', q: 'crash', before: null, limit: 25 })
    expect(result.current.total).toBe(1)
    act(() => result.current.next())
    expect(result.current.pageIndex).toBe(0)
  })
})
