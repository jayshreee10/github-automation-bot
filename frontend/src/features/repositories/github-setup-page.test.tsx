import { render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { connectInstallation } from './api'
import { GithubSetupPage } from './github-setup-page'

vi.mock('./api', () => ({ connectInstallation: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({ authClient: {} }))

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/github/setup', element: <GithubSetupPage /> },
      { path: '/', element: <p>dashboard</p> },
    ],
    { initialEntries: [path] },
  )
  // StrictMode runs effects twice, which the page must survive with a single request.
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

describe('GithubSetupPage', () => {
  beforeEach(() => {
    vi.mocked(connectInstallation).mockResolvedValue({ installations: [], repositories: [] })
  })

  it('explains a link without an installation id', () => {
    renderAt('/github/setup')
    expect(screen.getByText('No installation found in the link.')).toBeTruthy()
    expect(connectInstallation).not.toHaveBeenCalled()
  })

  it.each(['abc', '0', '-1', '1e5', '12345678901234567890'])('rejects installation_id=%s', (id) => {
    renderAt(`/github/setup?installation_id=${id}`)
    expect(screen.getByText('This setup link is not valid.')).toBeTruthy()
    expect(connectInstallation).not.toHaveBeenCalled()
  })

  it('connects once and returns to the dashboard', async () => {
    renderAt('/github/setup?installation_id=42&setup_action=install')
    expect(await screen.findByText('dashboard')).toBeTruthy()
    expect(connectInstallation).toHaveBeenCalledTimes(1)
    expect(connectInstallation).toHaveBeenCalledWith('42')
  })

  it('explains a 403 as an installation on another account', async () => {
    vi.mocked(connectInstallation).mockRejectedValue(new ApiError(403))
    renderAt('/github/setup?installation_id=42')
    expect(await screen.findByText('This installation is not on your GitHub account.')).toBeTruthy()
  })

  it('shows a generic error for other failures', async () => {
    vi.mocked(connectInstallation).mockRejectedValue(new ApiError(502))
    renderAt('/github/setup?installation_id=42')
    await waitFor(() =>
      expect(screen.getByText('Could not connect the installation. Please try again.')).toBeTruthy(),
    )
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toBeTruthy()
  })
})
