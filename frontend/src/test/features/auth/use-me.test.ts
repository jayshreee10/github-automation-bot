import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchMe } from '@/features/auth/api'
import { useMe } from '@/features/auth/use-me'

vi.mock('@/features/auth/api', () => ({ fetchMe: vi.fn() }))

describe('useMe', () => {
  it('loads the signed-in user from the API', async () => {
    const me = { id: 'u1', email: 'a@b.c', name: 'Ada', image: null, githubLogin: 'ada' }
    vi.mocked(fetchMe).mockResolvedValue(me)
    const { result } = renderHook(() => useMe())
    await waitFor(() => expect(result.current.me).toEqual(me))
    expect(result.current.error).toBeNull()
  })

  it('sets an error message when the API call fails', async () => {
    vi.mocked(fetchMe).mockRejectedValue(new Error('401'))
    const { result } = renderHook(() => useMe())
    await waitFor(() => expect(result.current.error).toBe('Could not load your profile from the API.'))
    expect(result.current.me).toBeNull()
  })
})
