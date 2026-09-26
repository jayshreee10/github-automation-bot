import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RepositoryList } from './repository-list'
import { useRepositories } from './use-repositories'

vi.mock('./use-repositories', () => ({ useRepositories: vi.fn() }))

const hook = (state: Partial<ReturnType<typeof useRepositories>>) =>
  vi.mocked(useRepositories).mockReturnValue({ data: null, error: null, syncing: null, sync: vi.fn(), ...state })

describe('RepositoryList', () => {
  it('links Connect repository to the App install page', () => {
    hook({})
    render(<RepositoryList />)
    expect(screen.getByRole('link', { name: 'Connect repository' }).getAttribute('href')).toBe(
      'https://github.com/apps/test-bot/installations/new',
    )
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('shows the empty state when nothing is installed', () => {
    hook({ data: { installations: [], repositories: [] } })
    render(<RepositoryList />)
    expect(screen.getByText(/No repositories connected yet/)).toBeTruthy()
  })

  it('shows an error instead of loading', () => {
    hook({ error: 'Could not load repositories.' })
    render(<RepositoryList />)
    expect(screen.getByText('Could not load repositories.')).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('renders one group per installation and marks the syncing one', () => {
    hook({
      data: {
        installations: [
          { id: '1', accountLogin: 'acme' },
          { id: '2', accountLogin: 'octo' },
        ],
        repositories: [{ id: '9', fullName: 'octo/app', isPrivate: false, installationId: '2', accountLogin: 'octo' }],
      },
      syncing: '2',
    })
    render(<RepositoryList />)
    expect(screen.getByText('acme')).toBeTruthy()
    expect(screen.getByText('octo/app')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sync' })).toBeTruthy()
  })
})
