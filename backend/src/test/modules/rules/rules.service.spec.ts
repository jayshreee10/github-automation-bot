import { describe, expect, it, vi } from 'vitest';
import { InvalidInputError, NotFoundError } from '../../../core/errors/domain.error.js';
import type { Rule as RuleRow } from '../../../generated/prisma/client.js';
import type { RulesRepository } from '../../../modules/rules/rules.repository.js';
import { RulesService } from '../../../modules/rules/rules.service.js';

const ID = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const CONDITIONS = {
  match: 'all' as const,
  titleContains: ['bug'],
  bodyContains: [],
  authors: [],
  excludeAuthors: [],
  labels: [],
  branches: [],
};

const row = (overrides: Partial<RuleRow> = {}): RuleRow => ({
  id: ID,
  repositoryId: 42n,
  userId: 'user-1',
  name: 'Label bugs',
  event: 'issues',
  conditions: CONDITIONS,
  actions: [{ type: 'add_label', labels: ['bug'] }],
  enabled: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  ...overrides,
});

function setup() {
  const repo = {
    listForUser: vi.fn().mockResolvedValue([row()]),
    findForUser: vi.fn().mockResolvedValue(row()),
    repositoryOwnedBy: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue(row()),
    update: vi.fn().mockImplementation(async (_id, rule) => row(rule)),
    delete: vi.fn().mockResolvedValue(undefined),
    findActive: vi.fn().mockResolvedValue([row()]),
    firedStats: vi.fn().mockResolvedValue([]),
  };
  return { repo, service: new RulesService(repo as unknown as RulesRepository) };
}

describe('RulesService', () => {
  it('list converts ids and dates for the API', async () => {
    const { service, repo } = setup();
    const [rule] = await service.list('user-1', '42');
    expect(repo.listForUser).toHaveBeenCalledWith('user-1', 42n);
    expect(rule).toMatchObject({ id: ID, repositoryId: '42', createdAt: '2026-01-01T00:00:00.000Z' });
  });

  it('list adds fired counts, zero for rules that never fired', async () => {
    const { service, repo } = setup();
    repo.listForUser.mockResolvedValue([row(), row({ id: 'other' })]);
    repo.firedStats.mockResolvedValue([{ ruleId: ID, firedCount: 3, lastFiredAt: new Date('2026-01-03T00:00:00Z') }]);
    const [fired, idle] = await service.list('user-1');
    expect(repo.firedStats).toHaveBeenCalledWith([ID, 'other']);
    expect(fired).toMatchObject({ firedCount: 3, lastFiredAt: '2026-01-03T00:00:00.000Z' });
    expect(idle).toMatchObject({ firedCount: 0, lastFiredAt: null });
  });

  it('get returns an owned rule and 404s otherwise', async () => {
    const { service, repo } = setup();
    expect(await service.get('user-1', ID)).toMatchObject({ id: ID, firedCount: 0 });
    expect(repo.findForUser).toHaveBeenCalledWith(ID, 'user-1');

    repo.findForUser.mockResolvedValue(null);
    await expect(service.get('user-2', ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('list without a filter passes undefined', async () => {
    const { service, repo } = setup();
    await service.list('user-1');
    expect(repo.listForUser).toHaveBeenCalledWith('user-1', undefined);
  });

  describe('create', () => {
    const body = {
      repositoryId: '42',
      name: 'Label bugs',
      event: 'issues' as const,
      conditions: CONDITIONS,
      actions: [{ type: 'add_label' as const, labels: ['bug'] }],
      enabled: true,
    };

    it('stores the rule for a repo the caller owns', async () => {
      const { service, repo } = setup();
      await service.create('user-1', body);
      const { repositoryId: _, ...definition } = body;
      expect(repo.create).toHaveBeenCalledWith('user-1', 42n, definition);
    });

    it('treats a repo the caller does not own as not found', async () => {
      const { service, repo } = setup();
      repo.repositoryOwnedBy.mockResolvedValue(false);
      await expect(service.create('user-1', body)).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('merges the change onto the stored rule', async () => {
      const { service, repo } = setup();
      const rule = await service.update('user-1', ID, { enabled: false });
      expect(repo.update).toHaveBeenCalledWith(ID, expect.objectContaining({ name: 'Label bugs', enabled: false }));
      expect(rule.enabled).toBe(false);
    });

    it('re-validates the merged rule: switching to push with a label action fails', async () => {
      const { service, repo } = setup();
      await expect(service.update('user-1', ID, { event: 'push' })).rejects.toBeInstanceOf(InvalidInputError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('treats another user’s rule as not found', async () => {
      const { service, repo } = setup();
      repo.findForUser.mockResolvedValue(null);
      await expect(service.update('user-2', ID, { enabled: false })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it('remove deletes only an owned rule', async () => {
    const { service, repo } = setup();
    await service.remove('user-1', ID);
    expect(repo.delete).toHaveBeenCalledWith(ID);

    repo.findForUser.mockResolvedValue(null);
    repo.delete.mockClear();
    await expect(service.remove('user-2', ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('findActive skips stored rules that no longer parse', async () => {
    const { service, repo } = setup();
    repo.findActive.mockResolvedValue([row(), row({ id: 'broken', actions: [{ type: 'unknown' }] })]);
    const rules = await service.findActive(42n, 'issues');
    expect(rules.map((r) => r.id)).toEqual([ID]);
  });
});
