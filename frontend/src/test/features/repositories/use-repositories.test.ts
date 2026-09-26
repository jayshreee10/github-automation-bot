import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRepositories, syncInstallation } from '@/features/repositories/api'
import type { RepositoryList } from '@/features/repositories/schemas'
import { resetRepositoriesStore, useRepositories } from '@/features/repositories/use-repositories'
import { repository } from '../../fixtures'

vi.mock('@/features/repositories/api', () => ({ fetchRepositories: vi.fn(), syncInstallation: vi.fn() }))

const acme = { id: '1', accountLogin: 'acme', accountType: 'User', repositorySelection: 'all' }
const octo = { id: '2', accountLogin: 'octo', accountType: 'Organization', repositorySelection: 'selected' }
const initial: RepositoryList = { installations: [acme], repositories: [] }
const synced: RepositoryList = { installations: [acme], repositories: [repository({ id: '9', isPrivate: true })] }

describe('useRepositories', () => {
  beforeEach(() => {
    resetRepositoriesStore()
    vi.mocked(fetchRepositories).mockReset().mockResolvedValue(initial)
  })

  it('shares one request between components mounted together', async () => {
    const a = renderHook(() => useRepositories())
    const b = renderHook(() => useRepositories())
    await waitFor(() => expect(b.result.current.data).toEqual(initial))
    expect(a.result.current.data).toEqual(initial)
    expect(fetchRepositories).toHaveBeenCalledTimes(1)
  })

  it('reuses fresh data for a later component instead of fetching again', async () => {
    const a = renderHook(() => useRepositories())
    await waitFor(() => expect(a.result.current.data).toEqual(initial))
    const b = renderHook(() => useRepositories())
    expect(b.result.current.data).toEqual(initial)
    expect(fetchRepositories).toHaveBeenCalledTimes(1)
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

  it('syncAll syncs every installation in turn and keeps the last list', async () => {
    const two: RepositoryList = { installations: [acme, octo], repositories: [] }
    vi.mocked(fetchRepositories).mockResolvedValue(two)
    vi.mocked(syncInstallation).mockReset().mockResolvedValueOnce(two).mockResolvedValueOnce(synced)
    const { result } = renderHook(() => useRepositories())
    await waitFor(() => expect(result.current.data).toEqual(two))

    let ok!: boolean
    await act(async () => {
      ok = await result.current.syncAll()
    })
    expect(ok).toBe(true)
    expect(vi.mocked(syncInstallation).mock.calls).toEqual([['1'], ['2']])
    expect(result.current.data).toEqual(synced)
    expect(result.current.syncing).toBeNull()
  })

  it('syncAll reports failure and keeps the old list', async () => {
    vi.mocked(syncInstallation).mockReset().mockRejectedValue(new Error('502'))
    const { result } = renderHook(() => useRepositories())
    await waitFor(() => expect(result.current.data).toEqual(initial))

    let ok!: boolean
    await act(async () => {
      ok = await result.current.syncAll()
    })
    expect(ok).toBe(false)
    expect(result.current.data).toEqual(initial)
  })
})
