import { describe, expect, it, vi } from 'vitest';
import { requestContext } from '../../../core/context/request-context.js';
import type { PrismaService } from '../../../core/database/prisma.service.js';
import { ConflictError, NotFoundError } from '../../../core/errors/domain.error.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { type FailureRow, FailuresRepository } from '../../../modules/failures/failures.repository.js';
import { FailuresService } from '../../../modules/failures/failures.service.js';
import { failureListSchema } from '../../../modules/failures/failures.types.js';

const JOB = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const row = (overrides: Partial<FailureRow> = {}): FailureRow => ({
  jobId: JOB,
  deliveryId: 'd-1',
  event: 'issues',
  action: 'opened',
  repositoryId: 42n,
  repositoryName: 'octo/repo',
  summaryTitle: 'bug: crash',
  summaryNumber: '7',
  summaryUrl: 'https://github.com/octo/repo/issues/7',
  summaryAuthor: 'alice',
  summaryRef: null,
  status: 'dead',
  attempts: 5,
  lastError: 'Error: GitHub 502',
  nextRunAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:10:00Z'),
  ...overrides,
});

const action = (deliveryId = 'd-1', status = 'failed', error: string | null = 'Slack webhook 404') => ({
  id: 'a1',
  deliveryId,
  type: 'slack_notify',
  rule: { name: 'Bugs' },
  status,
  attempts: 1,
  error,
});

function setup(rows: FailureRow[] = []) {
  const failures = {
    list: vi.fn().mockResolvedValue(rows),
    actionsFor: vi.fn().mockResolvedValue([]),
    retry: vi.fn().mockResolvedValue('d-1'),
    ownedJobStatus: vi.fn().mockResolvedValue(null),
  };
  const service = new FailuresService(failures as unknown as FailuresRepository);
  return { service, failures };
}

describe('FailuresService.list', () => {
  it('lists failed and dead jobs with every action of the delivery, filtered by repo', async () => {
    const { service, failures } = setup([row(), row({ jobId: 'j2', deliveryId: 'd-2', status: 'failed' })]);
    failures.actionsFor.mockResolvedValue([action('d-2', 'pending', 'Slack webhook 503')]);
    const list = await service.list('user-1', '42');
    expect(failures.list).toHaveBeenCalledWith('user-1', 42n, 100);
    expect(list.items[0]).toMatchObject({ status: 'dead', actions: [], retryable: true, maxAttempts: 5 });
    expect(list.items[1].actions).toEqual([
      { id: 'a1', type: 'slack_notify', ruleName: 'Bugs', status: 'pending', attempts: 1, error: 'Slack webhook 503' },
    ]);
    expect(failureListSchema.safeParse(list).success).toBe(true);
  });

  it('marks a succeeded job retryable only when it has failed actions', async () => {
    const { service, failures } = setup([
      row({ status: 'succeeded' }),
      row({ jobId: 'j2', deliveryId: 'd-2', status: 'running' }),
    ]);
    failures.actionsFor.mockResolvedValue([action('d-1'), action('d-2')]);
    const { items } = await service.list('u');
    expect(items.map((i) => i.retryable)).toEqual([true, false]);

    failures.actionsFor.mockResolvedValue([action('d-1', 'succeeded', null)]);
    expect((await service.list('u')).items[0].retryable).toBe(false);
  });

  it('skips the actions query when nothing failed', async () => {
    const { service, failures } = setup();
    expect(await service.list('u')).toEqual({ items: [] });
    expect(failures.actionsFor).not.toHaveBeenCalled();
  });
});

describe('FailuresService.retry', () => {
  it('queues an owned, retryable job and tags the request context', async () => {
    const { service, failures } = setup();
    const ctx = await requestContext.run({ requestId: 'r' }, async () => {
      await service.retry('user-1', JOB);
      return requestContext.get();
    });
    expect(failures.retry).toHaveBeenCalledWith('user-1', JOB);
    expect(ctx).toEqual({ requestId: 'r', deliveryId: 'd-1', jobId: JOB });
  });

  it('returns 404 for an unknown or foreign job', async () => {
    const { service, failures } = setup();
    failures.retry.mockResolvedValue(null);
    await expect(service.retry('user-1', JOB)).rejects.toThrow(NotFoundError);
    expect(failures.ownedJobStatus).toHaveBeenCalledWith('user-1', JOB);
  });

  it.each(['pending', 'running', 'succeeded'])('returns 409 for an owned job that is %s', async (status) => {
    const { service, failures } = setup();
    failures.retry.mockResolvedValue(null);
    failures.ownedJobStatus.mockResolvedValue(status);
    await expect(service.retry('user-1', JOB)).rejects.toThrow(ConflictError);
  });
});

describe('FailuresRepository SQL', () => {
  function setupRepo(updated: { deliveryId: string }[]) {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue(updated),
      action: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
      $queryRaw: vi.fn().mockResolvedValue([]),
      job: { findFirst: vi.fn().mockResolvedValue({ status: 'pending' }) },
    };
    return { tx, prisma, repo: new FailuresRepository(prisma as unknown as PrismaService) };
  }

  it('retry is one conditional, owner-scoped update, then failed actions go back to pending', async () => {
    const { tx, repo } = setupRepo([{ deliveryId: 'd-1' }]);
    await expect(repo.retry('user-1', JOB)).resolves.toBe('d-1');
    const [strings, ...values] = tx.$queryRaw.mock.calls[0];
    const sql = Prisma.sql(strings, ...values);
    expect(sql.text).toMatch(/j\.id = \$1::uuid .* i\.user_id = \$2/s);
    expect(sql.text).toContain("j.status IN ('failed', 'dead')");
    expect(sql.text).toContain("j.status = 'succeeded' AND EXISTS");
    expect(sql.text).toContain('attempts = 0');
    expect(sql.values).toEqual([JOB, 'user-1']);
    expect(tx.action.updateMany).toHaveBeenCalledWith({
      where: { deliveryId: 'd-1', status: 'failed' },
      data: { status: 'pending' },
    });
  });

  it('touches no actions when the job did not match', async () => {
    const { tx, repo } = setupRepo([]);
    await expect(repo.retry('user-1', JOB)).resolves.toBeNull();
    expect(tx.action.updateMany).not.toHaveBeenCalled();
  });

  it('checks job ownership through repo → installation → user', async () => {
    const { prisma, repo } = setupRepo([]);
    await expect(repo.ownedJobStatus('user-1', JOB)).resolves.toBe('pending');
    expect(prisma.job.findFirst).toHaveBeenCalledWith({
      where: { id: JOB, delivery: { repository: { installation: { userId: 'user-1' } } } },
      select: { status: true },
    });
  });

  it('lists only the caller’s failures', async () => {
    const { prisma, repo } = setupRepo([]);
    await repo.list('user-1', 42n, 100);
    const [strings, ...values] = prisma.$queryRaw.mock.calls[0];
    const sql = Prisma.sql(strings, ...values);
    expect(sql.text).toContain('i.user_id = $1');
    expect(sql.values).toEqual(['user-1', 42n, 100]);
  });
});
