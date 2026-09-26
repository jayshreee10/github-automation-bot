import { describe, expect, it, vi } from 'vitest';
import { delivery, fakeConfig } from '../../test/fakes.js';
import type { ActionRunner } from '../actions/action-runner.js';
import type { ActionsRepository } from '../actions/actions.repository.js';
import { HandlerRegistry } from '../queue/handler.registry.js';
import { PermanentJobError } from '../queue/job-errors.js';
import type { ActiveRule, RulesService } from './rules.service.js';
import { RulesEventHandler } from './rules-event.handler.js';

const EMPTY = { titleContains: [], bodyContains: [], authors: [], labels: [], branches: [] };
const rule = (id: string, titleContains: string[], actions: ActiveRule['actions']): ActiveRule => ({
  id,
  name: id,
  event: 'issues',
  conditions: { ...EMPTY, titleContains },
  actions,
  enabled: true,
});
const issuesPayload = (login = 'alice', title = 'bug: crash') => ({
  action: 'opened',
  repository: { id: 42, full_name: 'octo/repo' },
  sender: { login },
  issue: { number: 7, title, body: '', labels: [], html_url: 'https://x' },
});

function setup(rules: ActiveRule[] = []) {
  const registry = new HandlerRegistry();
  const service = { findActive: vi.fn().mockResolvedValue(rules) };
  const actions = { installationIdFor: vi.fn().mockResolvedValue(5) };
  const runner = { run: vi.fn().mockResolvedValue('succeeded') };
  const handler = new RulesEventHandler(
    registry,
    service as unknown as RulesService,
    actions as unknown as ActionsRepository,
    runner as unknown as ActionRunner,
    fakeConfig({ GITHUB_APP_SLUG: 'my-bot' }),
  );
  return { handler, registry, service, actions, runner };
}

describe('RulesEventHandler', () => {
  it('registers for issues, pull_request and push', () => {
    const { handler, registry } = setup();
    handler.onModuleInit();
    for (const e of ['issues', 'pull_request', 'push']) expect(registry.get(e)).toBe(handler);
  });

  it('runs every action of each matching rule, in order', async () => {
    const label = { type: 'add_label' as const, labels: ['bug'] };
    const slack = { type: 'slack_notify' as const };
    const { handler, runner, service } = setup([
      rule('r-bug', ['bug'], [label, slack]),
      rule('r-feature', ['feature'], [slack]),
    ]);
    await handler.handle(delivery({ payload: issuesPayload() }));

    expect(service.findActive).toHaveBeenCalledWith(42n, 'issues');
    expect(runner.run.mock.calls.map(([ctx, action]) => [ctx.ruleId, action.type])).toEqual([
      ['r-bug', 'add_label'],
      ['r-bug', 'slack_notify'],
    ]);
    expect(runner.run.mock.calls[0][0]).toMatchObject({ installationId: 5, ruleName: 'r-bug' });
  });

  it('skips deliveries for repos that were never connected', async () => {
    const { handler, service } = setup();
    await handler.handle(delivery({ repositoryId: null, payload: issuesPayload() }));
    expect(service.findActive).not.toHaveBeenCalled();
  });

  it('skips repos disconnected since the delivery arrived', async () => {
    const { handler, actions, service } = setup();
    actions.installationIdFor.mockResolvedValue(null);
    await handler.handle(delivery({ payload: issuesPayload() }));
    expect(service.findActive).not.toHaveBeenCalled();
  });

  it('ignores events sent by the bot itself (loop guard)', async () => {
    const { handler, runner, actions } = setup([rule('r', [], [{ type: 'slack_notify' }])]);
    await handler.handle(delivery({ payload: issuesPayload('my-bot[bot]') }));
    expect(actions.installationIdFor).not.toHaveBeenCalled();
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('fails the job when an action failed transiently, so it retries', async () => {
    const { handler, runner } = setup([rule('r', [], [{ type: 'add_label', labels: ['x'] }, { type: 'slack_notify' }])]);
    runner.run.mockResolvedValueOnce('retry').mockResolvedValueOnce('succeeded');
    await expect(handler.handle(delivery({ payload: issuesPayload() }))).rejects.toThrow('1 action(s) failed transiently');
    expect(runner.run).toHaveBeenCalledTimes(2);
  });

  it('completes the job when actions failed permanently or were already done', async () => {
    const { handler, runner } = setup([rule('r', [], [{ type: 'add_label', labels: ['x'] }, { type: 'slack_notify' }])]);
    runner.run.mockResolvedValueOnce('failed').mockResolvedValueOnce('done');
    await expect(handler.handle(delivery({ payload: issuesPayload() }))).resolves.toBeUndefined();
  });

  it('rejects a malformed payload permanently', async () => {
    const { handler } = setup();
    await expect(handler.handle(delivery({ payload: { action: 'opened' } }))).rejects.toBeInstanceOf(PermanentJobError);
  });
});
