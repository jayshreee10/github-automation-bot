import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useRepoFilter } from '@/features/shell/use-repo-filter'

const wrapper = (url: string) => ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
)

describe('useRepoFilter', () => {
  it('reads the repo id from ?repo=', () => {
    const { result } = renderHook(() => useRepoFilter(), { wrapper: wrapper('/?repo=42') })
    expect(result.current).toMatchObject({ repoId: '42', search: '?repo=42' })
  })

  it('ignores a malformed repo id', () => {
    const { result } = renderHook(() => useRepoFilter(), { wrapper: wrapper('/?repo=1%3BDROP') })
    expect(result.current).toMatchObject({ repoId: null, search: '' })
  })

  it('sets and clears the filter, keeping other params', () => {
    const { result } = renderHook(() => useRepoFilter(), { wrapper: wrapper('/?x=1') })
    act(() => result.current.setRepoId('43'))
    expect(result.current.repoId).toBe('43')
    act(() => result.current.setRepoId(null))
    expect(result.current.repoId).toBeNull()
  })
})
