import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteRule, fetchRules, updateRule } from '@/features/rules/api'
import { RulesPage } from '@/features/rules/rules-page'
import { repositories, rule } from '../../fixtures'

vi.mock('@/features/rules/api', () => ({ fetchRules: vi.fn(), updateRule: vi.fn(), deleteRule: vi.fn(), createRule: vi.fn() }))
vi.mock('@/features/repositories/use-repositories', () => ({
  useRepositories: () => ({ data: repositories, error: null, syncing: null, sync: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderAt(url = '/rules?repo=42') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <RulesPage />
    </MemoryRouter>,
  )
}

// Radix menus open on a primary-button pointerdown.
const openMenu = (trigger: HTMLElement) => fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })

describe('RulesPage', () => {
  beforeEach(() => {
    vi.mocked(fetchRules).mockReset().mockResolvedValue([
      rule({ firedCount: 41, lastFiredAt: new Date(Date.now() - 12_000).toISOString() }),
      rule({
        id: 'r-2',
        name: 'Docs triage',
        repositoryId: '43',
        enabled: false,
        conditions: { ...rule().conditions, titleContains: [] },
        actions: [{ type: 'add_comment', body: 'hi' }],
      }),
    ])
  })

  it('lists each rule with its event, conditions, actions and fired count', async () => {
    renderAt()
    const link = await screen.findByRole('link', { name: 'Label bugs' })
    expect(vi.mocked(fetchRules).mock.calls[0][0]).toBe('42')
    expect(link.getAttribute('href')).toBe('/rules/r-1?repo=42')
    const row = link.closest('tr')!
    expect(within(row).getByText('api')).toBeTruthy()
    expect(within(row).getByText('issues.opened')).toBeTruthy()
    expect(within(row).getByText('title contains "bug"')).toBeTruthy()
    expect(within(row).getByText('label: bug')).toBeTruthy()
    expect(within(row).getByText('Slack')).toBeTruthy()
    expect(within(row).getByText('41')).toBeTruthy()
    expect(within(row).getByText('12s ago')).toBeTruthy()

    const docs = screen.getByRole('link', { name: 'Docs triage' }).closest('tr')!
    expect(within(docs).getByText('Any issue')).toBeTruthy()
    expect(within(docs).getByText('Disabled')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'New rule' }).getAttribute('href')).toBe('/rules/new?repo=42')
  })

  it('filters by state and search text', async () => {
    renderAt()
    await screen.findByText('Label bugs')
    fireEvent.click(screen.getByRole('radio', { name: 'Disabled' }))
    expect(screen.queryByText('Label bugs')).toBeNull()
    expect(screen.getByText('Docs triage')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: /All/ }))
    fireEvent.change(screen.getByLabelText('Search rules'), { target: { value: 'nothing' } })
    expect(screen.getByText('No rules match this filter.')).toBeTruthy()
  })

  it('toggles a rule and reverts the switch when saving fails', async () => {
    vi.mocked(updateRule).mockResolvedValueOnce(rule({ enabled: false })).mockRejectedValueOnce(new Error('500'))
    renderAt()
    fireEvent.click(await screen.findByRole('switch', { name: 'Disable Label bugs' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable Label bugs' }).getAttribute('aria-checked')).toBe('false'))
    expect(updateRule).toHaveBeenCalledWith('r-1', { enabled: false })

    fireEvent.click(screen.getByRole('switch', { name: 'Enable Label bugs' }))
    await waitFor(() => expect(updateRule).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable Label bugs' }).getAttribute('aria-checked')).toBe('false'))
  })

  it('deletes from the row menu only after confirming', async () => {
    vi.mocked(deleteRule).mockResolvedValue()
    renderAt()
    openMenu(await screen.findByRole('button', { name: 'More actions for Label bugs' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(deleteRule).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('Label bugs')).toBeNull())
    expect(deleteRule).toHaveBeenCalledWith('r-1')
  })

  it('shows the empty state', async () => {
    vi.mocked(fetchRules).mockResolvedValue([])
    renderAt()
    expect(await screen.findByText('No rules yet')).toBeTruthy()
  })
})
