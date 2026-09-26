import { describe, expect, it } from 'vitest';
import { PermanentJobError } from '../queue/job-errors.js';
import { toRepoEvent } from './repo-event.js';

const repository = { id: 42, full_name: 'octo/repo' };
const sender = { login: 'alice' };
const issueLike = {
  number: 7,
  title: 'bug: crash',
  body: null,
  labels: [{ name: 'bug' }],
  html_url: 'https://github.com/octo/repo/issues/7',
};

describe('toRepoEvent', () => {
  it('normalises an issues payload', () => {
    expect(toRepoEvent('d1', 'issues', { action: 'opened', repository, sender, issue: issueLike })).toEqual({
      deliveryId: 'd1',
      event: 'issues',
      action: 'opened',
      repository: { id: 42, fullName: 'octo/repo' },
      actor: 'alice',
      number: 7,
      title: 'bug: crash',
      body: '',
      labels: ['bug'],
      ref: null,
      url: issueLike.html_url,
    });
  });

  it('normalises a pull_request payload with its head branch', () => {
    const e = toRepoEvent('d1', 'pull_request', {
      action: 'opened',
      repository,
      sender,
      pull_request: { ...issueLike, body: 'desc', labels: undefined, head: { ref: 'feature/x' } },
    });
    expect(e).toMatchObject({ event: 'pull_request', number: 7, body: 'desc', labels: [], ref: 'feature/x' });
  });

  it('normalises a push: first commit line is the title', () => {
    const e = toRepoEvent('d1', 'push', {
      ref: 'refs/heads/main',
      repository,
      sender,
      compare: 'https://github.com/octo/repo/compare/a...b',
      head_commit: { message: 'fix: thing\n\nlonger body' },
    });
    expect(e).toMatchObject({
      event: 'push',
      action: null,
      number: null,
      title: 'fix: thing',
      body: 'fix: thing\n\nlonger body',
      ref: 'refs/heads/main',
      url: 'https://github.com/octo/repo/compare/a...b',
    });
  });

  it('handles a push without a head commit (branch deletion)', () => {
    const e = toRepoEvent('d1', 'push', { ref: 'refs/heads/old', repository, sender, head_commit: null });
    expect(e).toMatchObject({ title: '', body: '', url: null });
  });

  it('throws a permanent error for an unreadable payload', () => {
    expect(() => toRepoEvent('d1', 'issues', { action: 'opened', repository })).toThrow(PermanentJobError);
  });

  it('throws a permanent error for a non-repo event', () => {
    expect(() => toRepoEvent('d1', 'star', {})).toThrow(PermanentJobError);
  });
});
