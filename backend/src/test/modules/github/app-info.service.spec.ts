import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpstreamUnavailableError } from '../../../core/errors/domain.error.js';
import { AppInfoService } from '../../../modules/github/app-info.service.js';
import type { GithubService } from '../../../modules/github/github.service.js';

const APP = { events: ['issues', 'push'], permissions: { issues: 'write', metadata: 'read' } };

function setup() {
  const github = { getApp: vi.fn().mockResolvedValue(APP) };
  return { github, service: new AppInfoService(github as unknown as GithubService) };
}

describe('AppInfoService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the App permissions and events, asking GitHub at most every 10 minutes', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const { service, github } = setup();
    await expect(service.get()).resolves.toEqual(APP);
    vi.advanceTimersByTime(9 * 60_000);
    await service.get();
    expect(github.getApp).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2 * 60_000);
    await service.get();
    expect(github.getApp).toHaveBeenCalledTimes(2);
  });

  it('maps GitHub failures to upstream unavailable and does not cache them', async () => {
    const { service, github } = setup();
    github.getApp.mockRejectedValueOnce(new Error('502'));
    await expect(service.get()).rejects.toBeInstanceOf(UpstreamUnavailableError);
    await expect(service.get()).resolves.toEqual(APP);
  });
});
