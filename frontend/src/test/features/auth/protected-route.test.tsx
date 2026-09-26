import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from '@/features/auth/protected-route'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession } }))

function LoginProbe() {
  const { pathname, search } = useLocation()
  return <p>login page {pathname + search}</p>
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginProbe /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/', element: <p>dashboard</p> },
          { path: '/github/setup', element: <p>setup</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useSession.mockReturnValue({ data: null, isPending: false })
  })

  it('shows a loading message while the session loads', () => {
    useSession.mockReturnValue({ data: null, isPending: true })
    renderAt('/')
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('sends a signed-out visitor at / to plain /login', () => {
    renderAt('/')
    expect(screen.getByText('login page /login')).toBeTruthy()
  })

  it('keeps the path and query in an encoded next param', () => {
    renderAt('/github/setup?installation_id=42')
    const next = encodeURIComponent('/github/setup?installation_id=42')
    expect(screen.getByText(`login page /login?next=${next}`)).toBeTruthy()
  })

  it('renders the child route when signed in', () => {
    useSession.mockReturnValue({ data: { user: { id: 'u1' } }, isPending: false })
    renderAt('/github/setup')
    expect(screen.getByText('setup')).toBeTruthy()
  })
})
