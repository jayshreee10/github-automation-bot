import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRepositories, syncInstallation } from './api'
import type { RepositoryList } from './schemas'
import { useRepositories } from './use-repositories'

vi.mock('./api', () => ({ fetchRepositories: vi.fn(), syncInstallation: vi.fn() }))

const initial: RepositoryList = { installations: [{ id: '1', accountLogin: 'acme' }], repositories: [] }
const synced: RepositoryList = {
  installations: [{ id: '1', accountLogin: 'acme' }],
  repositories: [{ id: '9', fullName: 'acme/api', isPrivate: true, installationId: '1', accountLogin: 'acme' }],
}

describe('useRepositories', () => {
  beforeEach(() => {
    vi.mocked(fetchRepositories).mockResolvedValue(initial)
  })

  it('loads the repository list on mount', async () => {
    const { result } = renderHook(() => useRepositories())
    await waitFor(() => expect(result.current.data).toEqual(initial))
    expect(result.current.error).toBeNull()
  })

  it('sets an error when loading fails', async () => {
    vi.mocked(fetchRepositories).mockRejectedValue(new Error('500'))
    const { result } = renderHook(() => useRepositories())
    await waitFor(() => expect(result.current.error).toBe('Could not load repositories.'))
  })

  it('marks the installation as syncing, then replaces the list', async () => {
    let resolve!: (v: RepositoryList) => void
    vi.mocked(syncInstallation).mockReturnValue(new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => useRepositories())
    await waitFor(() => expect(result.current.data).toEqual(initial))

    let done!: Promise<void>
    act(() => {
      done = result.current.sync('1')
    })
    expect(result.current.syncing).toBe('1')

    await act(async () => {
      resolve(synced)
      await done
    })
    expect(syncInstallation).toHaveBeenCalledWith('1')
    expect(result.current.data).toEqual(synced)
    expect(result.current.syncing).toBeNull()
  })

  it('clears an earlier error after a successful sync', async () => {
    vi.mocked(fetchRepositories).mockRejectedValue(new Error('500'))
    vi.mocked(syncInstallation).mockResolvedValue(synced)
    const { result } = renderHook(() => useRepositories())
    await waitFor(() => expect(result.current.error).not.toBeNull())

    await act(() => result.current.sync('1'))
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual(synced)
  })

  it('keeps the old list and shows an error when sync fails', async () => {
    vi.mocked(syncInstallation).mockRejectedValue(new Error('502'))
    const { result } = renderHook(() => useRepositories())
    await waitFor(() => expect(result.current.data).toEqual(initial))

    await act(() => result.current.sync('1'))
    expect(result.current.error).toBe('Sync failed. Please try again.')
    expect(result.current.data).toEqual(initial)
    expect(result.current.syncing).toBeNull()
  })
})
