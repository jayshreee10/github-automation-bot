import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Stats } from '@/features/events/schemas'
import { AppShell } from '@/features/shell/app-shell'
import { initials } from '@/lib/initials'
import { repositories } from '../../fixtures'

const signOut = vi.fn()
const me = vi.hoisted(() => ({ current: { id: 'u1', name: 'Ada Lovelace', email: 'ada@x.io', image: null, githubLogin: 'ada' } as Record<string, unknown> }))
const stats = vi.hoisted(() => ({ current: null as Stats | null }))

vi.mock('@/features/auth/use-me', () => ({ useMe: () => ({ me: me.current, error: null }) }))
vi.mock('@/features/auth/use-sign-out', () => ({ useSignOut: () => signOut }))
vi.mock('@/features/repositories/use-repositories', () => ({
  useRepositories: () => ({ data: repositories, error: null, syncing: null, sync: vi.fn() }),
}))
vi.mock('@/features/events/use-stats', () => ({ useStats: () => ({ data: stats.current, error: null, refresh: vi.fn() }) }))

const baseStats: Stats = {
  events: 1,
  eventsPrevious: 0,
  actionsSucceeded: 0,
  actionsFailed: 0,
  actionsByType: { add_label: 0, add_comment: 0, slack_notify: 0 },
  jobsDead: 0,
  jobs: { pending: 3, retrying: 2, dead: 1, succeeded: 5 },
  recoveredDeliveries: 0,
  webhook: { configured: true, lastDeliveryAt: new Date(Date.now() - 12_000).toISOString() },
}

function renderAt(url: string) {
  const router = createMemoryRouter([{ element: <AppShell />, children: [{ path: '*', element: <p>page body</p> }] }], {
    initialEntries: [url],
  })
  return render(<RouterProvider router={router} />)
}

describe('AppShell', () => {
  it('renders the sidebar nav with the repo filter kept on every link, and the page', () => {
    stats.current = baseStats
    renderAt('/rules?repo=42')
    expect(screen.getByText('page body')).toBeTruthy()
    const links: [RegExp, string][] = [
      [/^Dashboard/, '/'],
      [/^Event log/, '/events'],
      [/^Repositories/, '/repositories'],
      [/^Rules/, '/rules'],
      [/^Failures/, '/failures'],
    ]
    for (const [name, path] of links) expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(`${path}?repo=42`)
    expect(screen.getByRole('link', { name: /^Rules/ }).getAttribute('aria-current')).toBe('page')
  })

  it('shows repository and failure counts as badges', () => {
    stats.current = baseStats
    renderAt('/')
    expect(screen.getByRole('link', { name: /^Repositories/ }).textContent).toContain('2')
    expect(screen.getByRole('link', { name: /^Failures/ }).textContent).toContain('3')
  })

  it('hides the failure badge when nothing is retrying or dead', () => {
    stats.current = { ...baseStats, jobs: { ...baseStats.jobs, retrying: 0, dead: 0 } }
    renderAt('/')
    expect(screen.getByRole('link', { name: /^Failures/ }).textContent).toBe('Failures')
  })

  it('shows webhook health with the last delivery and queue size', () => {
    stats.current = baseStats
    renderAt('/')
    expect(screen.getByText('Webhook healthy')).toBeTruthy()
    expect(screen.getByText(/Last delivery 1[0-9]s ago · queue 3/)).toBeTruthy()
  })

  it('shows the user with initials, GitHub handle and a working sign-out', () => {
    stats.current = baseStats
    renderAt('/')
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByText('@ada')).toBeTruthy()
    expect(screen.getByText('AL')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalled()
  })

  it('uses the avatar image when the profile has one', () => {
    me.current = { ...me.current, image: 'https://avatars.githubusercontent.com/u/1' }
    const { container } = renderAt('/')
    expect(container.querySelector('img.avatar')?.getAttribute('src')).toBe('https://avatars.githubusercontent.com/u/1')
  })
})

describe('initials', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['narayan', 'NA'],
    ['  Grace  Brewster  Hopper ', 'GH'],
    ['', '?'],
  ])('%j → %s', (name, expected) => {
    expect(initials(name)).toBe(expected)
  })
})
