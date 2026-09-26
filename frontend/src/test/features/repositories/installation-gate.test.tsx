import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallationGate } from '@/features/repositories/installation-gate'
import { useRepositories } from '@/features/repositories/use-repositories'

vi.mock('@/features/repositories/use-repositories', () => ({ useRepositories: vi.fn() }))

const installation = { id: '1', accountLogin: 'alice', accountType: 'User', repositorySelection: 'all' }
const reload = vi.fn()

function renderGate(state: Partial<ReturnType<typeof useRepositories>>) {
  vi.mocked(useRepositories).mockReturnValue({ data: null, error: null, syncing: null, sync: vi.fn(), syncAll: vi.fn(), reload, ...state })
  const router = createMemoryRouter(
    [
      { element: <InstallationGate />, children: [{ path: '/', element: <p>dashboard</p> }] },
      { path: '/connect', element: <p>connect page</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

describe('InstallationGate', () => {
  beforeEach(() => reload.mockReset())

  it('waits while repositories load', () => {
    renderGate({})
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('sends a user without installations to /connect', () => {
    renderGate({ data: { installations: [], repositories: [] } })
    expect(screen.getByText('connect page')).toBeTruthy()
  })

  it('renders the app once an installation exists', () => {
    renderGate({ data: { installations: [installation], repositories: [] } })
    expect(screen.getByText('dashboard')).toBeTruthy()
  })

  it('offers a retry when loading fails', () => {
    renderGate({ error: 'Could not load repositories.' })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reload).toHaveBeenCalled()
  })
})
