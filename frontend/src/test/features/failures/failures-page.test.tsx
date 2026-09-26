import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFailures, retryJob } from '@/features/failures/api'
import { FailuresPage } from '@/features/failures/failures-page'
import type { Failure } from '@/features/failures/schemas'
import { ApiError } from '@/lib/api'
import { failure } from '../../fixtures'

vi.mock('@/features/failures/api', () => ({ fetchFailures: vi.fn(), retryJob: vi.fn() }))
vi.mock('@/features/shell/top-bar', () => ({ TopBar: () => null }))
vi.mock('@/features/events/use-stats', () => ({
  useStats: () => ({
    data: { jobs: { pending: 0, retrying: 2, dead: 1, succeeded: 9 }, recoveredDeliveries: 4 },
    error: null,
    refresh: vi.fn(),
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const item = (overrides: Partial<Failure> = {}): Failure => ({ ...failure(), maxAttempts: 5, ...overrides })
const NEXT = new Date(Date.now() + 38_000).toISOString()

const retrying = item({
  jobId: 'j-2',
  deliveryId: '7c1e9a42-0000-4000-8000-000000000000',
  status: 'failed',
  attempts: 2,
  nextRunAt: NEXT,
  summary: { title: 'security: token visible in logs', number: 39, url: null, author: 'alice', ref: null },
  actions: [
    { id: 'a-1', type: 'add_label', ruleName: 'Security', status: 'succeeded', attempts: 1, error: null },
    { id: 'a-2', type: 'slack_notify', ruleName: 'Security', status: 'pending', attempts: 2, error: 'Slack webhook 503' },
  ],
})
const dead = item({ jobId: 'j-3', status: 'dead', attempts: 5, actions: [], lastError: 'Error: GitHub 502' })

function renderAt(url = '/failures?repo=42') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <FailuresPage />
    </MemoryRouter>,
  )
}

describe('FailuresPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchFailures).mockResolvedValue({ items: [retrying, dead, item()] })
  })

  it('shows tiles from stats and loads failures for the selected repo', async () => {
    renderAt()
    await screen.findByText('#39 security: token visible in logs')
    expect(vi.mocked(fetchFailures).mock.calls[0][0]).toBe('42')
    expect(screen.getByText('Missed deliveries caught up')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
  })

  it('shows a retrying row with the pending action error, attempts and next try', async () => {
    renderAt()
    const row = (await screen.findByText('#39 security: token visible in logs')).closest('tr')!
    const cells = within(row)
    expect(cells.getByText('Slack notification')).toBeTruthy()
    expect(cells.getByText('Slack webhook 503')).toBeTruthy()
    expect(cells.getByText('2 / 5')).toBeTruthy()
    expect(cells.getByText(/^in \d+s$/)).toBeTruthy()
    expect(cells.getByText('issues.opened · 7c1e9a42')).toBeTruthy()
  })

  it('filters by tab', async () => {
    renderAt()
    await screen.findByText('#39 security: token visible in logs')
    fireEvent.click(screen.getByRole('radio', { name: /Dead/ }))
    expect(screen.queryByText('#39 security: token visible in logs')).toBeNull()
    expect(screen.getAllByText('Error: GitHub 502').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('radio', { name: /Retrying/ }))
    expect(screen.getByText('#39 security: token visible in logs')).toBeTruthy()
    expect(screen.queryByText('Error: GitHub 502')).toBeNull()
  })

  it('details the selected job and every action of its delivery', async () => {
    renderAt()
    await screen.findByText('#39 security: token visible in logs')
    const details = screen.getByRole('region', { name: 'Job details' })
    expect(within(details).getByText('2 of 5')).toBeTruthy()
    expect(within(details).getByText('delivery 7c1e9a42')).toBeTruthy()
    const actions = screen.getByRole('region', { name: 'Actions for this delivery' })
    expect(within(actions).getByText('Done · skipped on retry')).toBeTruthy()
    expect(within(actions).getByText('Pending retry')).toBeTruthy()
    expect(within(actions).getByText(/Backoff grows 4×/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open event/ }).getAttribute('href')).toBe(
      `/events?repo=42&delivery=${retrying.deliveryId}`,
    )

    fireEvent.click(screen.getByText('Error: GitHub 502'))
    expect(within(screen.getByRole('region', { name: 'Job details' })).getByText('5 of 5')).toBeTruthy()
  })

  it('retries a job, confirms with a toast and reloads the list', async () => {
    vi.mocked(retryJob).mockResolvedValue()
    renderAt()
    await screen.findByText('#39 security: token visible in logs')
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry now' })[0])
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(retryJob).toHaveBeenCalledWith('j-2')
    await waitFor(() => expect(fetchFailures).toHaveBeenCalledTimes(2))
  })

  it('explains a 409 as already queued', async () => {
    vi.mocked(retryJob).mockRejectedValue(new ApiError(409))
    renderAt()
    await screen.findByText('#39 security: token visible in logs')
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry now' })[0])
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Already queued or running'))
  })

  it('disables retry for a job that is not retryable', async () => {
    vi.mocked(fetchFailures).mockResolvedValue({ items: [item({ status: 'running', actions: [], retryable: false })] })
    renderAt()
    const button = await screen.findByRole('button', { name: 'Retry now' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the empty state', async () => {
    vi.mocked(fetchFailures).mockResolvedValue({ items: [] })
    renderAt()
    expect(await screen.findByText('Nothing has failed')).toBeTruthy()
  })
})
