import { describe, expect, it, vi } from 'vitest';
import { fakeConfig, jsonResponse } from '../../fakes.js';
import type { InstallationTokenService } from '../../../modules/github/installation-token.service.js';
import { GithubActions } from '../../../modules/actions/github-actions.js';

const REF = { installationId: 5, repoFullName: 'octo/repo', number: 7 };

function setup(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  const tokens = { withToken: vi.fn((_id: number, call: (t: string) => unknown) => call('inst-tok')) };
  const actions = new GithubActions(
    tokens as unknown as InstallationTokenService,
    fakeConfig({ GITHUB_APP_SLUG: 'my-bot' }),
  );
  return { fetch, tokens, actions };
}

const comment = (id: number, login: string | null, body: string) => ({
  id,
  html_url: `https://github.com/octo/repo/issues/7#issuecomment-${id}`,
  body,
  user: login ? { login } : null,
});

describe('GithubActions', () => {
  it('addLabels posts to the issue labels endpoint as the installation', async () => {
    const { fetch, tokens, actions } = setup(jsonResponse([{ name: 'bug' }, { name: 'old' }]));
    await expect(actions.addLabels(REF, ['bug'])).resolves.toEqual(['bug', 'old']);
    expect(tokens.withToken).toHaveBeenCalledWith(5, expect.any(Function));
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/octo/repo/issues/7/labels');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ labels: ['bug'] });
  });

  it('addComment returns the comment id and URL', async () => {
    const { fetch, actions } = setup(jsonResponse(comment(11, 'my-bot[bot]', 'hi')));
    await expect(actions.addComment(REF, 'hi')).resolves.toEqual({ id: 11, url: comment(11, '', '').html_url });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ body: 'hi' });
  });

  it('findComment returns only our bot’s comment carrying the marker', async () => {
    const marker = '<!-- bot:d1:r1 -->';
    const { fetch, actions } = setup(
      jsonResponse([
        comment(1, 'mallory', `copied ${marker}`),
        comment(2, 'my-bot[bot]', 'other comment'),
        comment(3, null, marker),
        comment(4, 'my-bot[bot]', `Thanks!\n\n${marker}`),
      ]),
    );
    const since = new Date('2026-01-01T00:00:00Z');
    await expect(actions.findComment(REF, marker, since)).resolves.toEqual({ id: 4, url: comment(4, '', '').html_url });
    expect(fetch.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/octo/repo/issues/7/comments?since=2026-01-01T00:00:00.000Z&per_page=100',
    );
  });

  it('findComment returns null when no comment matches', async () => {
    const { actions } = setup(jsonResponse([comment(1, 'mallory', 'x')]));
    await expect(actions.findComment(REF, '<!-- m -->', new Date())).resolves.toBeNull();
  });
});
