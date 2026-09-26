import { describe, expect, it } from 'vitest';
import { GithubApiError } from '../github/github-client.js';
import { PermanentActionError, SlackApiError, TransientActionError, toActionError } from './errors.js';

describe('toActionError', () => {
  it.each([
    [new GithubApiError(401, '/x'), TransientActionError],
    [new GithubApiError(429, '/x'), TransientActionError],
    [new GithubApiError(403, '/x', true), TransientActionError],
    [new GithubApiError(502, '/x'), TransientActionError],
    [new GithubApiError(403, '/x'), PermanentActionError],
    [new GithubApiError(404, '/x'), PermanentActionError],
    [new GithubApiError(422, '/x'), PermanentActionError],
    [new SlackApiError(429), TransientActionError],
    [new SlackApiError(500), TransientActionError],
    [new SlackApiError(404), PermanentActionError],
    [new Error('ECONNRESET'), TransientActionError],
    ['odd value', TransientActionError],
  ])('classifies %s', (err, Expected) => {
    expect(toActionError(err)).toBeInstanceOf(Expected);
  });

  it('returns already-classified errors unchanged', () => {
    const err = new PermanentActionError('x');
    expect(toActionError(err)).toBe(err);
  });

  it('redacts secrets from the message', () => {
    const err = toActionError(new Error('POST https://hooks.slack.com/services/T/B/secret failed'));
    expect(err.message).not.toContain('secret');
  });

  it('never puts the Slack URL in a SlackApiError', () => {
    expect(new SlackApiError(500).message).toBe('Slack webhook 500');
  });
});
