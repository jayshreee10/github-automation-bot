import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepositoriesPage } from '@/features/repositories/repositories-page'
import type { AppInfo, RepositoryList } from '@/features/repositories/schemas'
import { useAppInfo } from '@/features/repositories/use-app-info'
import { useRepositories } from '@/features/repositories/use-repositories'
import { repository } from '../../fixtures'

vi.mock('@/lib/auth-client', () => ({ authClient: { getSession: vi.fn().mockResolvedValue({ data: null }) } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/features/repositories/use-repositories', () => ({ useRepositories: vi.fn() }))
vi.mock('@/features/repositories/use-app-info', () => ({ useAppInfo: vi.fn() }))

const data: RepositoryList = {
  installations: [
    { id: '58213904', accountLogin: 'alice', accountType: 'User', repositorySelection: 'selected' },
    { id: '77', accountLogin: 'acme', accountType: 'Organization', repositorySelection: 'all' },
  ],
  repositories: [
    repository({ id: '1', fullName: 'alice/markly', installationId: '58213904', ruleCount: 2, lastEventAt: new Date(Date.now() - 8 * 60_000).toISOString() }),
    repository({ id: '2', fullName: 'alice/ffmint', installationId: '58213904', isPrivate: true, defaultBranch: 'dev', ruleCount: 0 }),
  ],
}
const app: AppInfo = { events: ['issues', 'push'], permissions: { issues: 'write', metadata: 'read' } }

function setup(state: Partial<ReturnType<typeof useRepositories>> = {}, appState: ReturnType<typeof useAppInfo> = { data: app, error: false }) {
  const syncAll = vi.fn().mockResolvedValue(true)
  vi.mocked(useRepositories).mockReturnValue({ data, error: null, syncing: null, sync: vi.fn(), syncAll, ...state })
  vi.mocked(useAppInfo).mockReturnValue(appState)
  render(
    <MemoryRouter>
      <RepositoriesPage />
    </MemoryRouter>,
  )
  return { syncAll }
}

describe('RepositoriesPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('describes each installation and links Configure to the right GitHub settings page', () => {
    setup()
    const alice = screen.getByRole('region', { name: 'alice' })
    expect(within(alice).getByText('Personal account · installation 58213904 · selected repos')).toBeTruthy()
    expect(within(alice).getByRole('link', { name: /Configure on GitHub/ }).getAttribute('href')).toBe(
      'https://github.com/settings/installations/58213904',
    )
    const acme = screen.getByRole('region', { name: 'acme' })
    expect(within(acme).getByText('Organization · installation 77 · all repos')).toBeTruthy()
    expect(within(acme).getByRole('link', { name: /Configure on GitHub/ }).getAttribute('href')).toBe(
      'https://github.com/organizations/acme/settings/installations/77',
    )
    expect(within(acme).getByText(/No repositories visible/)).toBeTruthy()
  })

  it('shows rule count, last event and status per repository', () => {
    setup()
    const receiving = screen.getByRole('row', { name: /alice\/markly/ })
    expect(within(receiving).getByText('Public · main')).toBeTruthy()
    expect(within(receiving).getByText('2')).toBeTruthy()
    expect(within(receiving).getByText('8m ago')).toBeTruthy()
    expect(within(receiving).getByText('Receiving')).toBeTruthy()

    const waiting = screen.getByRole('row', { name: /alice\/ffmint/ })
    expect(within(waiting).getByText('Private · dev')).toBeTruthy()
    expect(within(waiting).getByText('No events yet')).toBeTruthy()
    expect(within(waiting).getByText('Waiting for events')).toBeTruthy()
    // Event chips come from the App's subscribed events.
    expect(within(waiting).getByText('push')).toBeTruthy()
    expect(within(waiting).queryByText('pull_request')).toBeNull()
  })

  it('syncs every installation and confirms with a toast', async () => {
    const { syncAll } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Sync from GitHub' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Repositories synced from GitHub'))
    expect(syncAll).toHaveBeenCalledTimes(1)
  })

  it('reports a failed sync', async () => {
    const { syncAll } = setup()
    syncAll.mockResolvedValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Sync from GitHub' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sync failed. Please try again.'))
  })

  it('disables Sync while syncing', () => {
    setup({ syncing: 'all' })
    expect(screen.getByRole('button', { name: 'Syncing…' }).hasAttribute('disabled')).toBe(true)
  })

  it('lists App permissions (with Contents) and subscribed events', () => {
    setup()
    const perms = screen.getByRole('region', { name: 'App permissions' })
    expect(within(perms).getByText('Issues').nextElementSibling?.textContent).toBe('Read & write')
    expect(within(perms).getByText('Metadata').nextElementSibling?.textContent).toBe('Read')
    expect(within(perms).getByText('Contents').nextElementSibling?.textContent).toBe('No access')
    const events = screen.getByRole('region', { name: 'Subscribed events' })
    expect(within(events).getByText('opened, closed, labeled')).toBeTruthy()
    expect(within(events).getByText('all branches')).toBeTruthy()
  })

  it('keeps the page usable when App details fail, falling back to the default event chips', () => {
    setup({}, { data: null, error: true })
    expect(screen.getAllByText('Could not load app details.')).toHaveLength(2)
    const row = screen.getByRole('row', { name: /alice\/markly/ })
    expect(within(row).getByText('pull_request')).toBeTruthy()
  })

  it('offers the install link when nothing is connected', () => {
    setup({ data: { installations: [], repositories: [] } })
    expect(screen.getByText('No repositories connected yet')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Install GitHub App' }).getAttribute('href')).toBe(
      'https://github.com/apps/test-bot/installations/new',
    )
    expect(screen.getByRole('button', { name: 'Sync from GitHub' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows the load error', () => {
    setup({ data: null, error: 'Could not load repositories.' })
    expect(screen.getByText('Could not load repositories.')).toBeTruthy()
  })
})
