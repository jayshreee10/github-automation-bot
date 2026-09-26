import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventLog } from './event-log'
import type { EventLog as EventLogData } from './schemas'
import { useEventLog } from './use-event-log'

vi.mock('./use-event-log', () => ({ useEventLog: vi.fn() }))

const hook = (data: EventLogData | null, error: string | null = null) =>
  vi.mocked(useEventLog).mockReturnValue({ data, error })

const event = {
  id: 'd-1',
  event: 'issues',
  action: 'opened',
  repository: 'acme/api',
  title: 'bug: crash',
  url: null,
  status: 'succeeded' as const,
  attempts: 1,
  lastError: null,
  receivedAt: new Date().toISOString(),
}

describe('EventLog', () => {
  it('shows loading before the first response', () => {
    hook(null)
    render(<EventLog />)
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('shows the error and no loading text', () => {
    hook(null, 'Could not load events.')
    render(<EventLog />)
    expect(screen.getByText('Could not load events.')).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('shows the empty state and webhook status', () => {
    hook({ webhook: { configured: true, lastDeliveryAt: null }, events: [] })
    const { container } = render(<EventLog />)
    expect(screen.getByText(/No events yet/)).toBeTruthy()
    expect(container.querySelector('.webhook-status')?.getAttribute('data-state')).toBe('waiting')
  })

  it('lists events', () => {
    hook({
      webhook: { configured: true, lastDeliveryAt: event.receivedAt },
      events: [event, { ...event, id: 'd-2', title: 'second' }],
    })
    render(<EventLog />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('second')).toBeTruthy()
    expect(screen.getByText(/Webhook connected/)).toBeTruthy()
  })
})
