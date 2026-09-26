import { describe, expect, it } from 'vitest';
import { createRuleSchema, ruleDefinitionSchema, updateRuleSchema } from './rule.schema.js';

const base = {
  repositoryId: '42',
  name: 'Label bugs',
  event: 'issues',
  conditions: { titleContains: ['bug'] },
  actions: [{ type: 'add_label', labels: ['bug'] }],
};
const messages = (input: unknown) => {
  const r = createRuleSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('rule schemas', () => {
  it('fills defaults for a minimal rule', () => {
    const r = createRuleSchema.parse({ ...base, conditions: undefined });
    expect(r.enabled).toBe(true);
    expect(r.conditions).toEqual({ titleContains: [], bodyContains: [], authors: [], labels: [], branches: [] });
  });

  it('trims strings and rejects blank ones', () => {
    expect(createRuleSchema.parse({ ...base, name: '  Bugs  ' }).name).toBe('Bugs');
    expect(createRuleSchema.safeParse({ ...base, name: '   ' }).success).toBe(false);
  });

  it.each([
    ['a non-numeric repository id', { repositoryId: '42; drop' }],
    ['an unknown event', { event: 'star' }],
    ['no actions', { actions: [] }],
    ['an unknown action type', { actions: [{ type: 'delete_repo' }] }],
    ['an invalid author login', { conditions: { authors: ['not a login!'] } }],
    ['an uppercase webhook action', { conditions: { actions: ['Opened'] } }],
    ['more than 20 keywords', { conditions: { titleContains: Array(21).fill('x') } }],
    ['a label action without labels', { actions: [{ type: 'add_label', labels: [] }] }],
  ])('rejects %s', (_name, change) => {
    expect(createRuleSchema.safeParse({ ...base, ...change }).success).toBe(false);
  });

  it('accepts bot authors', () => {
    expect(createRuleSchema.safeParse({ ...base, conditions: { authors: ['dependabot[bot]'] } }).success).toBe(true);
  });

  it('allows at most one action of each type', () => {
    expect(messages({ ...base, actions: [{ type: 'slack_notify' }, { type: 'slack_notify' }] })).toContain(
      'at most one action of each type',
    );
  });

  describe('push rules', () => {
    const push = { ...base, event: 'push', conditions: {}, actions: [{ type: 'slack_notify' }] };

    it('accept slack_notify with branches', () => {
      expect(createRuleSchema.safeParse({ ...push, conditions: { branches: ['main'] } }).success).toBe(true);
    });

    it.each([
      [{ actions: [{ type: 'add_comment', body: 'hi' }] }, 'push rules only support slack_notify'],
      [{ conditions: { actions: ['opened'] } }, 'push events have no action'],
      [{ conditions: { labels: ['bug'] } }, 'push events have no labels'],
    ])('reject %o', (change, message) => {
      expect(messages({ ...push, ...change })).toContain(message);
    });
  });

  it('rejects branches on non-push rules', () => {
    expect(messages({ ...base, conditions: { branches: ['main'] } })).toContain('branches apply to push rules only');
  });

  it('ruleDefinitionSchema applies the same checks without a repository id', () => {
    const { repositoryId: _, ...definition } = base;
    expect(ruleDefinitionSchema.safeParse(definition).success).toBe(true);
    expect(ruleDefinitionSchema.safeParse({ ...definition, event: 'push' }).success).toBe(false);
  });

  it('update accepts any subset of fields but still validates each', () => {
    expect(updateRuleSchema.parse({ enabled: false })).toEqual({ enabled: false });
    expect(updateRuleSchema.safeParse({ name: '' }).success).toBe(false);
  });
});
