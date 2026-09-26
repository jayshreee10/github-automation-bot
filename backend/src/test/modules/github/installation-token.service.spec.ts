import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../fakes.js';
import { GithubApiError } from '../../../modules/github/github-client.js';
import type { GithubAppService } from '../../../modules/github/github-app.service.js';
import { InstallationTokenService } from '../../../modules/github/installation-token.service.js';

const HOUR = 3_600_000;

function setup() {
  let n = 0;
  const fetch = vi.fn(async () =>
    jsonResponse({
      token: `tok-${++n}`,
      expires_at: new Date(Date.now() + HOUR).toISOString(),
    }),
  );
  vi.stubGlobal('fetch', fetch);
  const app = { appJwt: vi.fn().mockResolvedValue('app-jwt') };
  return { fetch, service: new InstallationTokenService(app as unknown as GithubAppService) };
}

describe('InstallationTokenService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exchanges the App JWT for an installation token', async () => {
    const { fetch, service } = setup();
    await expect(service.tokenFor(7)).resolves.toBe('tok-1');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/app/installations/7/access_tokens');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer app-jwt');
  });

  it('caches per installation until 5 minutes before expiry', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const { fetch, service } = setup();
    await service.tokenFor(7);
    await service.tokenFor(8);
    vi.advanceTimersByTime(54 * 60_000);
    expect(await service.tokenFor(7)).toBe('tok-1');
    expect(fetch).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(60_000);
    expect(await service.tokenFor(7)).toBe('tok-3');
  });

  it('forget() drops the cached token', async () => {
    const { service } = setup();
    await service.tokenFor(7);
    service.forget(7);
    expect(await service.tokenFor(7)).toBe('tok-2');
  });

  describe('withToken', () => {
    it('on 401 refreshes the token and retries once', async () => {
      const { service } = setup();
      const call = vi
        .fn()
        .mockRejectedValueOnce(new GithubApiError(401, '/x'))
        .mockResolvedValueOnce('ok');
      await expect(service.withToken(7, call)).resolves.toBe('ok');
      expect(call.mock.calls).toEqual([['tok-1'], ['tok-2']]);
    });

    it('does not retry a second 401', async () => {
      const { service } = setup();
      const call = vi.fn().mockRejectedValue(new GithubApiError(401, '/x'));
      await expect(service.withToken(7, call)).rejects.toMatchObject({ status: 401 });
      expect(call).toHaveBeenCalledTimes(2);
    });

    it.each([new GithubApiError(403, '/x'), new Error('network')])(
      'rethrows %s without retrying',
      async (err) => {
        const { service } = setup();
        const call = vi.fn().mockRejectedValue(err);
        await expect(service.withToken(7, call)).rejects.toBe(err);
        expect(call).toHaveBeenCalledTimes(1);
      },
    );
  });
});
