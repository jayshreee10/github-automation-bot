import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../fakes.js';
import type { GithubAppService } from '../../../modules/github/github-app.service.js';
import { GithubService } from '../../../modules/github/github.service.js';
import type { InstallationTokenService } from '../../../modules/github/installation-token.service.js';

function setup(...responses: Response[]) {
  const fetch = vi.fn();
  for (const r of responses) fetch.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fetch);
  const app = { appJwt: vi.fn().mockResolvedValue('app-jwt') };
  const tokens = { tokenFor: vi.fn().mockResolvedValue('inst-tok') };
  const service = new GithubService(
    app as unknown as GithubAppService,
    tokens as unknown as InstallationTokenService,
  );
  const paths = () => fetch.mock.calls.map(([url]) => String(url).replace('https://api.github.com', ''));
  return { fetch, service, paths };
}

const repo = (id: number) => ({ id, full_name: `o/r${id}`, private: false });
const attempt = (guid: string, at: string, status = 200) => ({
  id: 1,
  guid,
  delivered_at: at,
  status_code: status,
  event: 'issues',
});

describe('GithubService', () => {
  it('getInstallation authenticates as the App', async () => {
    const { service, fetch } = setup(
      jsonResponse({ id: 5, account: { id: 1, login: 'alice', type: 'User' } }),
    );
    await expect(service.getInstallation(5)).resolves.toEqual({
      id: 5,
      account: { id: 1, login: 'alice', type: 'User' },
    });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer app-jwt');
  });

  it('listInstallationRepos pages until total_count is reached', async () => {
    const { service, paths } = setup(
      jsonResponse({ total_count: 3, repositories: [repo(1), repo(2)] }),
      jsonResponse({ total_count: 3, repositories: [repo(3)] }),
    );
    const repos = await service.listInstallationRepos(5);
    expect(repos.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(paths()).toEqual([
      '/installation/repositories?per_page=100&page=1',
      '/installation/repositories?per_page=100&page=2',
    ]);
  });

  it('listInstallationRepos stops on an empty page', async () => {
    const { service, fetch } = setup(
      jsonResponse({ total_count: 10, repositories: [repo(1)] }),
      jsonResponse({ total_count: 10, repositories: [] }),
    );
    await expect(service.listInstallationRepos(5)).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('listHookDeliveries follows pages and stops at the first one reaching past `since`', async () => {
    const since = new Date('2026-01-02T00:00:00Z');
    const { service, paths } = setup(
      jsonResponse([attempt('a', '2026-01-03T00:00:00Z')], {
        headers: { link: '<https://api.github.com/app/hook/deliveries?cursor=2>; rel="next"' },
      }),
      jsonResponse([attempt('b', '2026-01-02T12:00:00Z'), attempt('c', '2026-01-01T00:00:00Z')], {
        headers: { link: '<https://api.github.com/app/hook/deliveries?cursor=3>; rel="next"' },
      }),
    );
    const out = await service.listHookDeliveries(since);
    expect(out.map((d) => d.guid)).toEqual(['a', 'b']);
    expect(paths()).toEqual(['/app/hook/deliveries?per_page=100', '/app/hook/deliveries?cursor=2']);
  });

  it('redeliver posts a new attempt for the delivery', async () => {
    const { service, fetch, paths } = setup(jsonResponse({}, { status: 202 }));
    await service.redeliver('123456789012345678901');
    expect(paths()).toEqual(['/app/hook/deliveries/123456789012345678901/attempts']);
    expect(fetch.mock.calls[0][1].method).toBe('POST');
  });

  it.each([
    [{ url: 'https://smee.io/x', content_type: 'json' }, true],
    [{ url: '', content_type: 'json' }, false],
    [{ url: null }, false],
  ])('hookConfigured(%o) is %s', async (config, expected) => {
    const { service } = setup(jsonResponse(config));
    await expect(service.hookConfigured()).resolves.toBe(expected);
  });
});
