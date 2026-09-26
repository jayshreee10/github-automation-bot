import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../core/database/prisma.service.js';
import { ActionsRepository } from '../../../modules/actions/actions.repository.js';

function setup() {
  const action = {
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'a1' }),
    update: vi.fn().mockResolvedValue({}),
  };
  const repository = { findUnique: vi.fn() };
  const repo = new ActionsRepository({ action, repository } as unknown as PrismaService);
  return { repo, action, repository };
}

describe('ActionsRepository', () => {
  it('ensure inserts if absent, then reads the one row for the key', async () => {
    const { repo, action } = setup();
    const key = { deliveryId: 'd1', ruleId: 'r1', type: 'slack_notify' as const };
    await expect(repo.ensure(key)).resolves.toEqual({ id: 'a1' });
    expect(action.createMany).toHaveBeenCalledWith({ data: [key], skipDuplicates: true });
    expect(action.findUniqueOrThrow).toHaveBeenCalledWith({ where: { deliveryId_ruleId_type: key } });
  });

  it.each([
    [true, 'failed'],
    [false, 'pending'],
  ])('fail(permanent=%s) sets status %s', async (permanent, status) => {
    const { repo, action } = setup();
    await repo.fail('a1', 'err', permanent, 120);
    expect(action.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { status, error: 'err', durationMs: 120 } });
  });

  it('installationIdFor returns a number, or null for an unknown repo', async () => {
    const { repo, repository } = setup();
    repository.findUnique.mockResolvedValueOnce({ installationId: 5n }).mockResolvedValueOnce(null);
    await expect(repo.installationIdFor(42n)).resolves.toBe(5);
    await expect(repo.installationIdFor(43n)).resolves.toBeNull();
  });
});
