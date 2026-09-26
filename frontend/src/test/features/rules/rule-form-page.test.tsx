import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRule, deleteRule, fetchRule, updateRule } from '@/features/rules/api'
import { RuleFormPage } from '@/features/rules/rule-form-page'
import { ApiError } from '@/lib/api'
import { repositories, rule } from '../../fixtures'

vi.mock('@/features/rules/api', () => ({
  fetchRule: vi.fn(),
  fetchRules: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  createRule: vi.fn(),
}))
vi.mock('@/features/repositories/use-repositories', () => ({
  useRepositories: () => ({ data: repositories, error: null, syncing: null, sync: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/rules/new" element={<RuleFormPage />} />
        <Route path="/rules/:id" element={<RuleFormPage />} />
        <Route path="/rules" element={<p>rules list</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// Types into a chip input and presses Enter to add the value.
function addChip(label: string, value: string) {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save rule' }))

describe('RuleFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a rule for the filtered repo from chips and switches, then returns to the list', async () => {
    vi.mocked(createRule).mockResolvedValue(rule())
    renderAt('/rules/new?repo=42')
    fireEvent.change(await screen.findByLabelText('Rule name'), { target: { value: 'Feature requests' } })
    addChip('Condition 1 values', 'feature')
    addChip('Condition 1 values', 'idea')
    fireEvent.click(screen.getByRole('switch', { name: 'Add label' }))
    addChip('Labels to add', 'enhancement')
    expect(screen.getByText('Unsaved changes')).toBeTruthy()
    expect(screen.getByText(/When an issue is opened in api, and the title contains "feature" or "idea"/)).toBeTruthy()
    save()
    await screen.findByText('rules list')
    expect(createRule).toHaveBeenCalledWith('42', {
      name: 'Feature requests',
      event: 'issues',
      conditions: {
        match: 'all',
        titleContains: ['feature', 'idea'],
        bodyContains: [],
        authors: [],
        excludeAuthors: [],
        labels: [],
        branches: [],
      },
      actions: [{ type: 'add_label', labels: ['enhancement'] }, { type: 'slack_notify' }],
      enabled: true,
    })
  })

  it('shows validation errors per section and does not call the API', async () => {
    renderAt('/rules/new')
    fireEvent.click(await screen.findByRole('switch', { name: 'Send Slack notification' }))
    save()
    expect(await screen.findByText('give the rule a name')).toBeTruthy()
    expect(screen.getByText('choose a repository')).toBeTruthy()
    expect(screen.getByText('choose at least one action')).toBeTruthy()
    expect(screen.getByLabelText('Rule name').getAttribute('aria-invalid')).toBe('true')
    expect(createRule).not.toHaveBeenCalled()
  })

  it('switching to push turns off label and comment', async () => {
    renderAt('/rules/new?repo=42')
    fireEvent.click(await screen.findByRole('button', { name: /Code pushed/ }))
    expect(screen.getByRole('button', { name: /Code pushed/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Add label' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/Push events have no issue/)).toBeTruthy()
  })

  it('loads an existing rule by id, locks the repository and saves changes', async () => {
    const stored = rule({ conditions: { ...rule().conditions, excludeAuthors: ['dependabot[bot]'] } })
    vi.mocked(fetchRule).mockResolvedValue(stored)
    vi.mocked(updateRule).mockResolvedValue(stored)
    renderAt('/rules/r-1?repo=42')
    const name = await screen.findByLabelText('Rule name')
    expect(fetchRule).toHaveBeenCalledWith('r-1', expect.any(AbortSignal))
    expect((name as HTMLInputElement).value).toBe('Label bugs')
    expect(screen.getByLabelText('Repository').hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('dependabot[bot]')).toBeTruthy()
    expect(screen.queryByText('Unsaved changes')).toBeNull()

    fireEvent.change(name, { target: { value: 'Bug reports' } })
    save()
    await screen.findByText('rules list')
    expect(updateRule).toHaveBeenCalledWith('r-1', expect.objectContaining({ name: 'Bug reports', conditions: stored.conditions }))
  })

  it('shows the server message when saving is rejected', async () => {
    vi.mocked(fetchRule).mockResolvedValue(rule())
    vi.mocked(updateRule).mockRejectedValue(new ApiError(400, 'push rules only support slack_notify'))
    renderAt('/rules/r-1')
    await screen.findByLabelText('Rule name')
    save()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not saved: push rules only support slack_notify'))
  })

  it('reports an unknown rule', async () => {
    vi.mocked(fetchRule).mockRejectedValue(new ApiError(404))
    renderAt('/rules/missing')
    expect(await screen.findByText('Rule not found.')).toBeTruthy()
  })

  it('deletes the rule after confirming', async () => {
    vi.mocked(fetchRule).mockResolvedValue(rule())
    vi.mocked(deleteRule).mockResolvedValue()
    renderAt('/rules/r-1')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete rule' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await screen.findByText('rules list')
    expect(deleteRule).toHaveBeenCalledWith('r-1')
  })
})
