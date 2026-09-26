import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ConnectGithubPage } from '@/features/repositories/connect-github-page'
import { useRepositories } from '@/features/repositories/use-repositories'

const signOut = vi.fn()
vi.mock('@/features/auth/use-sign-out', () => ({ useSignOut: () => signOut }))
vi.mock('@/features/repositories/use-repositories', () => ({ useRepositories: vi.fn() }))

function renderPage(data: ReturnType<typeof useRepositories>['data']) {
  vi.mocked(useRepositories).mockReturnValue({ data, error: null, syncing: null, sync: vi.fn(), syncAll: vi.fn(), reload: vi.fn() })
  const router = createMemoryRouter(
    [
      { path: '/connect', element: <ConnectGithubPage /> },
      { path: '/', element: <p>dashboard</p> },
    ],
    { initialEntries: ['/connect'] },
  )
  render(<RouterProvider router={router} />)
}

describe('ConnectGithubPage', () => {
  it('links to the GitHub App install page and can sign out', () => {
    renderPage({ installations: [], repositories: [] })
    expect(screen.getByRole('link', { name: 'Install GitHub App' }).getAttribute('href')).toBe(
      'https://github.com/apps/test-bot/installations/new',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalled()
  })

  it('skips to the dashboard when the app is already installed', () => {
    renderPage({ installations: [{ id: '1', accountLogin: 'alice', accountType: 'User', repositorySelection: 'all' }], repositories: [] })
    expect(screen.getByText('dashboard')).toBeTruthy()
  })
})
