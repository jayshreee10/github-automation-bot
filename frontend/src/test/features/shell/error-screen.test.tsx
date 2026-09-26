import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ErrorScreen } from '@/features/shell/error-screen'

function Boom(): never {
  throw new Error('kaboom')
}

function renderRoute(loader?: () => never) {
  const router = createMemoryRouter([{ path: '/', element: <Boom />, loader, errorElement: <ErrorScreen /> }])
  return render(<RouterProvider router={router} />)
}

describe('ErrorScreen', () => {
  it('replaces a crashed page with a recovery screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderRoute()
    expect(await screen.findByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('kaboom')).toBeTruthy() // dev-only detail
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to dashboard' }).getAttribute('href')).toBe('/')
  })

  it('shows the status for thrown route responses', async () => {
    renderRoute(() => {
      throw new Response(null, { status: 404, statusText: 'Not Found' })
    })
    expect(await screen.findByText('404 Not Found')).toBeTruthy()
  })
})
