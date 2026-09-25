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
  return schema.parse(await res.json());
}
