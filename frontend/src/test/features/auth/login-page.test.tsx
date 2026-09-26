import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '@/features/auth/login-page'

const { useSession, social } = vi.hoisted(() => ({ useSession: vi.fn(), social: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession, signIn: { social } } }))

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <p>home</p> },
      { path: '/github/setup', element: <p>setup</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('LoginPage', () => {
  beforeEach(() => {
    useSession.mockReturnValue({ data: null, isPending: false })
    social.mockResolvedValue({ error: null })
  })

  it('shows a loading message while the session loads', () => {
    useSession.mockReturnValue({ data: null, isPending: true })
    renderAt('/login')
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('redirects a signed-in user to the safe next path', () => {
    useSession.mockReturnValue({ data: { user: { id: 'u1' } }, isPending: false })
    renderAt(`/login?next=${encodeURIComponent('/github/setup')}`)
    expect(screen.getByText('setup')).toBeTruthy()
  })

  it('ignores an off-site next path', () => {
    useSession.mockReturnValue({ data: { user: { id: 'u1' } }, isPending: false })
    renderAt(`/login?next=${encodeURIComponent('//evil.com')}`)
    expect(screen.getByText('home')).toBeTruthy()
  })

  it('explains what the app accesses', () => {
    renderAt('/login')
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    expect(screen.getByText('We never read your code. Only issue, PR and push metadata.')).toBeTruthy()
  })

  it('starts GitHub sign-in with an absolute callback URL', async () => {
    renderAt(`/login?next=${encodeURIComponent('/github/setup?installation_id=1')}`)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }))
    expect(social).toHaveBeenCalledWith({
      provider: 'github',
      callbackURL: `${window.location.origin}/github/setup?installation_id=1`,
    })
    expect(screen.queryByText(/Sign-in failed/)).toBeNull()
  })

  it('shows an error when sign-in fails', async () => {
    social.mockResolvedValue({ error: { message: 'boom' } })
    renderAt('/login')
    fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }))
    expect(await screen.findByText('Sign-in failed. Please try again.')).toBeTruthy()
  })
})
