import { describe, expect, it, vi } from 'vitest';
import type { GithubService } from '../github/github.service.js';
import type { GithubHookDelivery } from '../github/github.types.js';
import { CatchUpService } from './catch-up.service.js';
import type { WebhookDeliveryRepository } from './webhook-delivery.repository.js';

let seq = 0;
const attempt = (guid: string, status: number): GithubHookDelivery => ({
  id: String(++seq),
  guid,
  status_code: status,
  delivered_at: '2026-01-01T00:00:00Z',
  event: 'issues',
});

function setup(attempts: GithubHookDelivery[], stored: string[] = []) {
  const github = {
    listHookDeliveries: vi.fn().mockResolvedValue(attempts),
    redeliver: vi.fn().mockResolvedValue(undefined),
  };
  const deliveries = { findStoredIds: vi.fn().mockResolvedValue(new Set(stored)) };
  const service = new CatchUpService(
    github as unknown as GithubService,
    deliveries as unknown as WebhookDeliveryRepository,
  );
  return { service, github, deliveries };
}

describe('CatchUpService', () => {
  it('redelivers failed deliveries we never stored', async () => {
    const failed = attempt('a', 502);
    const { service, github } = setup([failed, attempt('b', 202), attempt('c', 0)], ['c']);
    await service.run();
    expect(github.redeliver.mock.calls).toEqual([[failed.id]]);
  });

  it('judges each guid by its latest attempt (newest first)', async () => {
    // "a" failed earlier, but its latest redelivery succeeded.
    const { service, github } = setup([attempt('a', 200), attempt('a', 500)]);
    await service.run();
    expect(github.redeliver).not.toHaveBeenCalled();
  });

  it('skips the database lookup when nothing failed', async () => {
    const { service, deliveries } = setup([attempt('a', 200)]);
    await service.run();
    expect(deliveries.findStoredIds).not.toHaveBeenCalled();
  });

  it('caps redelivery requests at 10 per run', async () => {
    const many = Array.from({ length: 15 }, (_, i) => attempt(`g${i}`, 500));
    const { service, github } = setup(many);
    await service.run();
    expect(github.redeliver).toHaveBeenCalledTimes(10);
  });

  it('looks back three days', async () => {
    const { service, github } = setup([]);
    const before = Date.now();
    await service.run();
    const since = github.listHookDeliveries.mock.calls[0][0] as Date;
    expect(before - since.getTime()).toBeGreaterThanOrEqual(3 * 24 * 3_600_000 - 1000);
  });

  it('swallows GitHub failures so boot is never blocked', async () => {
    const { service, github } = setup([]);
    github.listHookDeliveries.mockRejectedValue(new Error('down'));
    await expect(service.run()).resolves.toBeUndefined();
  });

  it('does not overlap runs', async () => {
    const { service, github } = setup([]);
    let release!: () => void;
    github.listHookDeliveries.mockReturnValue(new Promise((r) => (release = () => r([]))));
    const first = service.run();
    await service.run();
    release();
    await first;
    expect(github.listHookDeliveries).toHaveBeenCalledTimes(1);
  });
});
