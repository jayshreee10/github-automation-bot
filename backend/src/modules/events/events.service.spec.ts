import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GithubService } from '../github/github.service.js';
import type { EventRow, EventsRepository } from './events.repository.js';
import { EventsService } from './events.service.js';
import { eventLogSchema } from './events.types.js';

const row = (id: string, at: string): EventRow => ({
  id,
  event: 'issues',
  action: 'opened',
  repository: 'octo/repo',
  title: 't',
  url: null,
  status: 'succeeded',
  attempts: 1,
  lastError: null,
  receivedAt: new Date(at),
});

function setup(rows: EventRow[] = []) {
  const events = { recentForUser: vi.fn().mockResolvedValue(rows) };
  const github = { hookConfigured: vi.fn().mockResolvedValue(true) };
  const service = new EventsService(events as unknown as EventsRepository, github as unknown as GithubService);
  return { service, events, github };
}

describe('EventsService.list', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns ISO timestamps and the newest delivery time, matching the API schema', async () => {
    const { service, events } = setup([row('b', '2026-01-02T00:00:00Z'), row('a', '2026-01-01T00:00:00Z')]);
    const log = await service.list('user-1', 20);
    expect(events.recentForUser).toHaveBeenCalledWith('user-1', 20);
    expect(log.webhook).toEqual({ configured: true, lastDeliveryAt: '2026-01-02T00:00:00.000Z' });
    expect(eventLogSchema.safeParse(log).success).toBe(true);
  });

  it('reports no last delivery when there are no events', async () => {
    const { service } = setup();
    expect((await service.list('u', 20)).webhook.lastDeliveryAt).toBeNull();
  });

  it('reports configured as null when GitHub cannot be asked', async () => {
    const { service, github } = setup();
    github.hookConfigured.mockRejectedValue(new Error('down'));
    expect((await service.list('u', 20)).webhook.configured).toBeNull();
  });

  it('asks GitHub at most once a minute', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const { service, github } = setup();
    await service.list('u', 20);
    vi.advanceTimersByTime(59_000);
    await service.list('u', 20);
    expect(github.hookConfigured).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    await service.list('u', 20);
    expect(github.hookConfigured).toHaveBeenCalledTimes(2);
  });
});
