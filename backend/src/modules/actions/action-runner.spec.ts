import { describe, expect, it, vi } from 'vitest';
import { repoEvent } from '../../test/fakes.js';
import { GithubApiError } from '../github/github-client.js';
import { type ActionContext, ActionRunner } from './action-runner.js';
import type { ActionsRepository } from './actions.repository.js';
import { SlackApiError } from './errors.js';
import type { GithubActions } from './github-actions.js';
import type { SlackNotifier } from './slack-notifier.js';

const CREATED = new Date('2026-01-01T00:10:00Z');
const ctx = (overrides: Partial<ActionContext> = {}): ActionContext => ({
  event: repoEvent({ deliveryId: 'd1' }),
  installationId: 5,
  ruleId: 'r1',
  ruleName: 'Bugs',
  ...overrides,
});
const MARKER = '<!-- bot:d1:r1 -->';

function setup(row: { status?: string; attempts?: number } = {}) {
  const repo = {
    ensure: vi.fn().mockResolvedValue({ id: 'a1', status: 'pending', attempts: 0, createdAt: CREATED, ...row }),
    begin: vi.fn().mockResolvedValue(undefined),
    succeed: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  };
  const github = {
    addLabels: vi.fn().mockResolvedValue(['bug']),
    addComment: vi.fn().mockResolvedValue({ id: 1, url: 'u' }),
    findComment: vi.fn().mockResolvedValue(null),
  };
  const slack = { notify: vi.fn().mockResolvedValue(undefined) };
  const runner = new ActionRunner(
    repo as unknown as ActionsRepository,
    github as unknown as GithubActions,
    slack as unknown as SlackNotifier,
  );
  return { runner, repo, github, slack };
}

describe('ActionRunner', () => {
  it('keys the action row by delivery, rule and type', async () => {
    const { runner, repo } = setup();
    await runner.run(ctx(), { type: 'slack_notify' });
    expect(repo.ensure).toHaveBeenCalledWith({ deliveryId: 'd1', ruleId: 'r1', type: 'slack_notify' });
  });

  it.each(['succeeded', 'failed'])('skips an action already %s (no duplicate side effect)', async (status) => {
    const { runner, repo, slack } = setup({ status });
    await expect(runner.run(ctx(), { type: 'slack_notify' })).resolves.toBe('done');
    expect(repo.begin).not.toHaveBeenCalled();
    expect(slack.notify).not.toHaveBeenCalled();
  });

  it('counts the attempt before acting, then records success with the result', async () => {
    const { runner, repo, github } = setup();
    await expect(runner.run(ctx(), { type: 'add_label', labels: ['bug'] })).resolves.toBe('succeeded');
    expect(github.addLabels).toHaveBeenCalledWith({ installationId: 5, repoFullName: 'octo/repo', number: 7 }, ['bug']);
    expect(repo.begin.mock.invocationCallOrder[0]).toBeLessThan(github.addLabels.mock.invocationCallOrder[0]);
    expect(repo.succeed).toHaveBeenCalledWith('a1', { labels: ['bug'] });
  });

  it('renders placeholders and appends the idempotency marker to comments', async () => {
    const { runner, github } = setup();
    await runner.run(ctx(), { type: 'add_comment', body: 'Thanks {author}! Re: {title} {url} {unknown}' });
    expect(github.addComment.mock.calls[0][1]).toBe(
      `Thanks alice! Re: bug: crash on save https://github.com/octo/repo/issues/7 {unknown}\n\n${MARKER}`,
    );
  });

  it('does not look for an earlier comment on the first attempt', async () => {
    const { runner, github } = setup();
    await runner.run(ctx(), { type: 'add_comment', body: 'hi' });
    expect(github.findComment).not.toHaveBeenCalled();
  });

  it('on retry, recovers a comment posted before a crash instead of posting twice', async () => {
    const { runner, repo, github } = setup({ attempts: 1 });
    github.findComment.mockResolvedValue({ id: 9, url: 'u9' });
    await expect(runner.run(ctx(), { type: 'add_comment', body: 'hi' })).resolves.toBe('succeeded');
    expect(github.findComment).toHaveBeenCalledWith(expect.anything(), MARKER, new Date(CREATED.getTime() - 60_000));
    expect(github.addComment).not.toHaveBeenCalled();
    expect(repo.succeed).toHaveBeenCalledWith('a1', { id: 9, url: 'u9', recovered: true });
  });

  it('on retry, posts when no earlier comment is found', async () => {
    const { runner, github } = setup({ attempts: 1 });
    await runner.run(ctx(), { type: 'add_comment', body: 'hi' });
    expect(github.addComment).toHaveBeenCalled();
  });

  it('sends Slack notifications with the rule name', async () => {
    const { runner, slack } = setup();
    await runner.run(ctx(), { type: 'slack_notify' });
    expect(slack.notify).toHaveBeenCalledWith(ctx().event, 'Bugs');
  });

  it('a transient failure keeps the action pending and asks for a retry', async () => {
    const { runner, repo, slack } = setup();
    slack.notify.mockRejectedValue(new SlackApiError(503));
    await expect(runner.run(ctx(), { type: 'slack_notify' })).resolves.toBe('retry');
    expect(repo.fail).toHaveBeenCalledWith('a1', 'Slack webhook 503', false);
  });

  it('a permanent failure marks the action failed', async () => {
    const { runner, repo, github } = setup();
    github.addLabels.mockRejectedValue(new GithubApiError(404, '/repos/x'));
    await expect(runner.run(ctx(), { type: 'add_label', labels: ['x'] })).resolves.toBe('failed');
    expect(repo.fail).toHaveBeenCalledWith('a1', expect.stringContaining('404'), true);
  });

  it('labels and comments fail permanently on a push, which has no issue', async () => {
    const { runner, repo, github } = setup();
    const push = ctx({ event: repoEvent({ event: 'push', number: null }) });
    await expect(runner.run(push, { type: 'add_label', labels: ['x'] })).resolves.toBe('failed');
    expect(github.addLabels).not.toHaveBeenCalled();
    expect(repo.fail).toHaveBeenCalledWith('a1', 'push has no issue or PR', true);
  });
});
