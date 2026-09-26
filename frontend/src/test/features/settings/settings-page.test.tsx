import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSlackSettings, saveSlackSettings, sendSlackTest } from '@/features/settings/api'
import type { SlackSettings } from '@/features/settings/schemas'
import { SettingsPage } from '@/features/settings/settings-page'
import { ApiError } from '@/lib/api'

vi.mock('@/features/settings/api', () => ({ fetchSlackSettings: vi.fn(), saveSlackSettings: vi.fn(), sendSlackTest: vi.fn() }))
vi.mock('@/features/auth/use-me', () => ({
  useMe: () => ({ me: { id: 'u1', name: 'Narayan', githubLogin: 'narayann7', email: null, image: null }, error: null }),
}))
vi.mock('@/features/auth/use-sign-out', () => ({ useSignOut: () => vi.fn() }))
vi.mock('@/features/events/use-stats', () => ({ useStats: () => ({ data: { recoveredDeliveries: 4 }, error: null }) }))
vi.mock('@/features/repositories/use-repositories', () => ({
  useRepositories: () => ({ data: { installations: [{ id: '1' }, { id: '2' }], repositories: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const settings = (overrides: Partial<SlackSettings> = {}): SlackSettings => ({
  connected: false,
  webhookLast4: null,
  channelLabel: null,
  includeLink: true,
  updatedAt: null,
  ...overrides,
})
const URL = 'https://hooks.slack.com/services/T0/B0/new1'

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.mocked(fetchSlackSettings).mockReset().mockResolvedValue(settings())
    vi.mocked(saveSlackSettings).mockReset()
    vi.mocked(sendSlackTest).mockReset().mockResolvedValue(undefined)
  })

  it('asks for a webhook while none is saved', async () => {
    renderPage()
    expect(await screen.findByText('Not connected')).toBeTruthy()
    expect(screen.getByText(/Required for Slack/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Send test message' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('links the webhook field to a how-to video in a new tab', async () => {
    renderPage()
    const help = await screen.findByRole('link', { name: 'How to get a Slack webhook URL (video)' })
    expect(help.getAttribute('href')).toBe('https://www.youtube.com/watch?v=LOS_rRlCr7U')
    expect(help.getAttribute('target')).toBe('_blank')
    expect(help.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('will not save other fields until a webhook is added', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Channel label'), { target: { value: '#eng' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Add your Slack Incoming Webhook URL')).toBeTruthy()
    expect(saveSlackSettings).not.toHaveBeenCalled()
  })

  it('saves a new custom webhook with the other changed fields', async () => {
    vi.mocked(saveSlackSettings).mockResolvedValue(
      settings({ connected: true, webhookLast4: 'new1', channelLabel: '#eng', updatedAt: '2026-09-27T10:00:00.000Z' }),
    )
    renderPage()
    fireEvent.change(await screen.findByLabelText('Incoming webhook URL'), { target: { value: URL } })
    fireEvent.change(screen.getByLabelText('Channel label'), { target: { value: '#eng' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(saveSlackSettings).toHaveBeenCalledWith({ webhookUrl: URL, channelLabel: '#eng' }))
    expect(await screen.findByText('Connected')).toBeTruthy()
    expect((screen.getByLabelText('Incoming webhook URL') as HTMLInputElement).value).toBe('••••••••••••new1')
    expect(toast.success).toHaveBeenCalledWith('Slack settings saved')
  })

  it('blocks a non-Slack URL before calling the API', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Incoming webhook URL'), { target: { value: 'https://example.com/x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Use the Incoming Webhook URL/)).toBeTruthy()
    expect(saveSlackSettings).not.toHaveBeenCalled()
  })

  it('tests a typed URL before saving, and shows Slack rejections', async () => {
    vi.mocked(sendSlackTest).mockRejectedValue(new ApiError(400, 'Slack rejected the webhook (404)'))
    renderPage()
    fireEvent.change(await screen.findByLabelText('Incoming webhook URL'), { target: { value: URL } })
    fireEvent.click(screen.getByRole('button', { name: 'Send test message' }))
    await waitFor(() => expect(sendSlackTest).toHaveBeenCalledWith(URL))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Slack rejected the webhook (404)'))
  })

  it('replaces or removes a saved custom webhook', async () => {
    vi.mocked(fetchSlackSettings).mockResolvedValue(settings({ connected: true, webhookLast4: 'abcd', updatedAt: '2026-09-27T10:00:00.000Z' }))
    vi.mocked(saveSlackSettings).mockResolvedValue(settings({ updatedAt: '2026-09-27T11:00:00.000Z' }))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Replace' }))
    expect((screen.getByLabelText('Incoming webhook URL') as HTMLInputElement).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(saveSlackSettings).toHaveBeenCalledWith({ webhookUrl: null }))
    expect(await screen.findByText('Not connected')).toBeTruthy()
    expect(toast.success).toHaveBeenCalledWith('Webhook removed. Slack notifications are off.')
  })

  it('shows the GitHub App connection and the account', async () => {
    renderPage()
    expect(await screen.findByText(`${window.location.origin}/api/webhooks/github`)).toBeTruthy()
    expect(screen.getByText('2 accounts · 3 repositories')).toBeTruthy()
    expect(screen.getByText('4 missed deliveries recovered')).toBeTruthy()
    expect(screen.getByText('Narayan · @narayann7')).toBeTruthy()
  })
})
