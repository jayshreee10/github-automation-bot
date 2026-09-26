import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSignOut } from './use-sign-out'

const { signOut, navigate } = vi.hoisted(() => ({ signOut: vi.fn(), navigate: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut } }))
vi.mock('react-router', () => ({ useNavigate: () => navigate }))

describe('useSignOut', () => {
  it('ends the session, then replaces history with /login', async () => {
    const order: string[] = []
    signOut.mockImplementation(async () => order.push('signOut'))
    navigate.mockImplementation(() => order.push('navigate'))

    const { result } = renderHook(() => useSignOut())
    await result.current()

    expect(order).toEqual(['signOut', 'navigate'])
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})
