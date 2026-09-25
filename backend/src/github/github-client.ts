import type { z } from 'zod';

const API = 'https://api.github.com';

// Carries only the HTTP status and path; response bodies may echo request data, so they are not kept.
export class GithubApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`GitHub API ${status} on ${path}`);
    this.name = 'GithubApiError';
  }
}

// Thin fetch wrapper: pins the API version, authenticates with a bearer token, zod-parses the body.
export async function githubFetch<T>(
  path: string,
  token: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const res = await githubRequest(path, token, init);
  return schema.parse(parseJson(await res.text()));
}

// Same as githubFetch, plus the next page's path from the Link header (cursor pagination).
export async function githubFetchPage<T>(
  path: string,
  token: string,
  schema: z.ZodType<T>,
): Promise<{ data: T; next: string | null }> {
  const res = await githubRequest(path, token);
  const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '');
  return {
    data: schema.parse(parseJson(await res.text())),
    next: next ? next[1].replace(API, '') : null,
  };
}

// Integers past 2^53 (e.g. hook delivery ids) would be rounded by JSON.parse; keep their exact digits as strings.
function parseJson(text: string): unknown {
  return JSON.parse(text, (_key, value, ctx?: { source?: string }) =>
    typeof value === 'number' && !Number.isSafeInteger(value) && ctx?.source
      ? ctx.source
      : value,
  );
}

// Raw request for calls whose body we don't need; throws GithubApiError on non-2xx.
export async function githubRequest(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'github-automation-bot',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new GithubApiError(res.status, path);
  return res;
}
