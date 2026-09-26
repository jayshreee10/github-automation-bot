import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../core/database/prisma.service.js';
import { PermanentJobError } from './job-errors.js';
import { type ClaimedJob, JobRepository } from './job.repository.js';

const LOCKED = new Date('2026-01-01T00:00:00Z');
const job = (attempts: number): ClaimedJob => ({ id: 'j1', deliveryId: 'd1', attempts, lockedAt: LOCKED });

function setup() {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const repo = new JobRepository({ job: { updateMany } } as unknown as PrismaService);
  const data = () => updateMany.mock.calls[0][0].data;
  return { repo, updateMany, data };
}

describe('JobRepository', () => {
  it('succeed is fenced on the lock it claimed', async () => {
    const { repo, updateMany } = setup();
    await repo.succeed(job(1));
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'j1', status: 'running', lockedAt: LOCKED },
      data: { status: 'succeeded', lockedAt: null, lastError: null },
    });
  });

  it('a transient failure schedules a retry with backoff', async () => {
    const { repo, updateMany, data } = setup();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const before = Date.now();
    await expect(repo.fail(job(2), new Error('boom'))).resolves.toBe('failed');
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: 'j1', status: 'running', lockedAt: LOCKED });
    expect(data()).toMatchObject({ status: 'failed', lockedAt: null, lastError: 'Error: boom' });
    expect(data().nextRunAt.getTime() - before).toBeGreaterThanOrEqual(120_000);
  });

  it('a permanent error goes straight to dead', async () => {
    const { repo, data } = setup();
    await expect(repo.fail(job(1), new PermanentJobError('bad payload'))).resolves.toBe('dead');
    expect(data()).toEqual({
      status: 'dead',
      lockedAt: null,
      lastError: 'PermanentJobError: bad payload',
    });
  });

  it('the fifth failed attempt is dead', async () => {
    const { repo } = setup();
    await expect(repo.fail(job(4), new Error('x'))).resolves.toBe('failed');
    await expect(repo.fail(job(5), new Error('x'))).resolves.toBe('dead');
  });

  it('stores a redacted, truncated error', async () => {
    const { repo, data } = setup();
    await repo.fail(job(1), new Error(`Bearer abc.def ${'x'.repeat(1000)}`));
    expect(data().lastError).not.toContain('abc.def');
    expect(data().lastError).toHaveLength(500);
  });

  it('stringifies non-Error failures', async () => {
    const { repo, data } = setup();
    await repo.fail(job(1), 'plain');
    expect(data().lastError).toBe('plain');
  });
});
