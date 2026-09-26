import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSignOut } from '@/features/auth/use-sign-out'

const { signOut, navigate, reset } = vi.hoisted(() => ({ signOut: vi.fn(), navigate: vi.fn(), reset: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut } }))
vi.mock('react-router', () => ({ useNavigate: () => navigate }))
vi.mock('@/features/repositories/use-repositories', () => ({ resetRepositoriesStore: reset }))

describe('useSignOut', () => {
  it('ends the session, forgets cached repositories, then replaces history with /login', async () => {
    const order: string[] = []
    signOut.mockImplementation(async () => order.push('signOut'))
    reset.mockImplementation(() => order.push('reset'))
    navigate.mockImplementation(() => order.push('navigate'))

    const { result } = renderHook(() => useSignOut())
    await result.current()

    expect(order).toEqual(['signOut', 'reset', 'navigate'])
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})
