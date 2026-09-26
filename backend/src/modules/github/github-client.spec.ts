import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { jsonResponse } from '../../test/fakes.js';
import {
  GithubApiError,
  githubFetch,
  githubFetchPage,
  githubRequest,
} from './github-client.js';

function stubFetch(...responses: Response[]) {
  const fetch = vi.fn();
  for (const r of responses) fetch.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('githubRequest', () => {
  it('pins the API version and sends the bearer token', async () => {
    const fetch = stubFetch(jsonResponse({}));
    await githubRequest('/app', 'tok', { method: 'POST', body: '{}' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.github.com/app');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('omits Content-Type when there is no body', async () => {
    const fetch = stubFetch(jsonResponse({}));
    await githubRequest('/app', 'tok');
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
  });

  it('throws GithubApiError with status and path, never the body', async () => {
    stubFetch(jsonResponse({ message: 'secret echo' }, { status: 404 }));
    const err = await githubRequest('/repos/x', 'tok').catch((e) => e);
    expect(err).toBeInstanceOf(GithubApiError);
    expect(err).toMatchObject({ status: 404, path: '/repos/x', rateLimited: false });
    expect(err.message).not.toContain('secret echo');
  });

  it.each([
    [403, { 'x-ratelimit-remaining': '0' }, true],
    [429, { 'retry-after': '30' }, true],
    [403, {}, false],
    [500, { 'retry-after': '30' }, false],
  ])('flags status %i with headers %o as rate limited: %s', async (status, headers, limited) => {
    stubFetch(jsonResponse({}, { status, headers }));
    const err = (await githubRequest('/x', 't').catch((e: unknown) => e)) as GithubApiError;
    expect(err.rateLimited).toBe(limited);
  });
});

describe('githubFetch', () => {
  it('zod-parses the body and strips unknown fields', async () => {
    stubFetch(jsonResponse({ id: 1, extra: true }));
    await expect(githubFetch('/x', 't', z.object({ id: z.number() }))).resolves.toEqual({ id: 1 });
  });

  it('rejects a body of the wrong shape', async () => {
    stubFetch(jsonResponse({ id: 'nope' }));
    await expect(githubFetch('/x', 't', z.object({ id: z.number() }))).rejects.toThrow();
  });

  it('keeps integers beyond 2^53 exact, as strings', async () => {
    stubFetch(new Response('{"id": 12345678901234567890, "small": 5}'));
    const body = await githubFetch('/x', 't', z.object({ id: z.unknown(), small: z.number() }));
    expect(body).toEqual({ id: '12345678901234567890', small: 5 });
  });
});

describe('githubFetchPage', () => {
  it('returns the next page path from the Link header', async () => {
    stubFetch(
      jsonResponse([1], {
        headers: {
          link: '<https://api.github.com/app/hook/deliveries?cursor=abc>; rel="next", <https://api.github.com/x>; rel="last"',
        },
      }),
    );
    await expect(githubFetchPage('/app/hook/deliveries', 't', z.array(z.number()))).resolves.toEqual({
      data: [1],
      next: '/app/hook/deliveries?cursor=abc',
    });
  });

  it('returns null when there is no next page', async () => {
    stubFetch(jsonResponse([]));
    const page = await githubFetchPage('/x', 't', z.array(z.number()));
    expect(page.next).toBeNull();
  });
});
