import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TopBar } from '@/features/shell/top-bar'
import { repositories } from '../../fixtures'

vi.mock('@/features/repositories/use-repositories', () => ({
  useRepositories: () => ({ data: repositories, error: null, syncing: null, sync: vi.fn() }),
}))

function renderAt(url: string, element: React.ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: [url] })
  return render(<RouterProvider router={router} />)
}

afterEach(() => document.documentElement.classList.remove('dark'))

describe('TopBar', () => {
  it('renders crumbs, linking earlier ones with the repo filter kept', () => {
    renderAt('/rules/1?repo=42', <TopBar crumbs={[{ label: 'Rules', to: '/rules' }, { label: 'Bug reports' }]} />)
    expect(screen.getByRole('link', { name: 'Rules' }).getAttribute('href')).toBe('/rules?repo=42')
    expect(screen.getByText('Bug reports').getAttribute('aria-current')).toBe('page')
  })

  it('shows the live pill and the selected repository when asked', () => {
    renderAt('/?repo=43', <TopBar crumbs={[{ label: 'Dashboard' }]} live repoFilter />)
    expect(screen.getByText('Live · refreshes every 5s')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Repository filter' }).textContent).toContain('web')
    expect(screen.getByRole('button', { name: 'Repository filter' }).textContent).not.toContain('acme/')
  })

  it('searches repositories by name inside the filter menu', async () => {
    renderAt('/', <TopBar crumbs={[{ label: 'Dashboard' }]} repoFilter />)
    const trigger = screen.getByRole('button', { name: 'Repository filter' })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search repositories' }), { target: { value: 'we' } })
    expect(screen.getAllByRole('menuitemradio').map((i) => i.textContent)).toEqual(['web'])
  })

  it('defaults the filter to all repositories', () => {
    renderAt('/', <TopBar crumbs={[{ label: 'Dashboard' }]} repoFilter />)
    expect(screen.getByRole('button', { name: 'Repository filter' }).textContent).toContain('All repositories')
  })

  it('toggles dark mode on the document', () => {
    renderAt('/', <TopBar crumbs={[{ label: 'Dashboard' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Toggle dark mode' }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Toggle dark mode' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('replaces the right side with page actions', () => {
    renderAt('/', <TopBar crumbs={[{ label: 'Rules' }]} actions={<button type="button">Save rule</button>} />)
    expect(screen.getByRole('button', { name: 'Save rule' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Toggle dark mode' })).toBeNull()
  })
})
