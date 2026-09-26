import { describe, expect, it } from 'vitest';
import { repoEvent } from '../../test/fakes.js';
import { matches } from './rule-matcher.js';
import type { RuleConditions, RuleDefinition } from './rule.schema.js';

const EMPTY: RuleConditions = { titleContains: [], bodyContains: [], authors: [], labels: [], branches: [] };
const rule = (conditions: Partial<RuleConditions> = {}, event: RuleDefinition['event'] = 'issues') => ({
  event,
  conditions: { ...EMPTY, ...conditions },
});

describe('matches', () => {
  it('requires the same event type', () => {
    expect(matches(rule({}, 'pull_request'), repoEvent())).toBe(false);
  });

  it('defaults to the "opened" action for issues and PRs', () => {
    expect(matches(rule(), repoEvent({ action: 'opened' }))).toBe(true);
    expect(matches(rule(), repoEvent({ action: 'edited' }))).toBe(false);
    expect(matches(rule({ actions: ['edited', 'reopened'] }), repoEvent({ action: 'reopened' }))).toBe(true);
    expect(matches(rule(), repoEvent({ action: null }))).toBe(false);
  });

  it.each([
    ['bug', 'bug: crash on save', true],
    ['bug', 'Bug report', true],
    ['bug', 'BUG!', true],
    ['bug', 'debug logging', false],
    ['bug', 'bugfix', false],
    ['c++', 'crash in C++ parser', true],
    ['.*', 'anything', false],
    ['café', 'Café closed', true],
  ])('title keyword %j vs %j → %s (whole word, case-insensitive)', (keyword, title, expected) => {
    expect(matches(rule({ titleContains: [keyword] }), repoEvent({ title: title }))).toBe(expected);
  });

  it('matches any keyword in a list (OR)', () => {
    expect(matches(rule({ titleContains: ['feature', 'crash'] }), repoEvent())).toBe(true);
  });

  it('requires every non-empty condition (AND)', () => {
    const r = rule({ titleContains: ['bug'], bodyContains: ['reproduce'], authors: ['bob'] });
    expect(matches(r, repoEvent())).toBe(false);
    expect(matches(r, repoEvent({ actor: 'Bob' }))).toBe(true);
  });

  it('compares authors and labels case-insensitively', () => {
    expect(matches(rule({ authors: ['ALICE'] }), repoEvent())).toBe(true);
    expect(matches(rule({ labels: ['Urgent'] }), repoEvent({ labels: ['urgent', 'bug'] }))).toBe(true);
    expect(matches(rule({ labels: ['urgent'] }), repoEvent({ labels: [] }))).toBe(false);
  });

  describe('push', () => {
    const push = (ref: string | null) =>
      repoEvent({ event: 'push', action: null, number: null, ref, title: 'fix: x', body: 'fix: x' });

    it('ignores the action condition', () => {
      expect(matches(rule({}, 'push'), push('refs/heads/main'))).toBe(true);
    });

    it('filters by branch name without the refs/heads/ prefix', () => {
      const r = rule({ branches: ['main', 'release/1.0'] }, 'push');
      expect(matches(r, push('refs/heads/main'))).toBe(true);
      expect(matches(r, push('refs/heads/release/1.0'))).toBe(true);
      expect(matches(r, push('refs/heads/dev'))).toBe(false);
      expect(matches(r, push('refs/tags/main'))).toBe(false);
      expect(matches(r, push(null))).toBe(false);
    });
  });
});
