import { describe, expect, it, vi } from 'vitest';
import { delivery } from '../../fakes.js';
import { HandlerRegistry } from '../../../modules/queue/handler.registry.js';
import { PermanentJobError } from '../../../modules/queue/job-errors.js';
import type { ClaimedJob, JobRepository } from '../../../modules/queue/job.repository.js';
import { WorkerService } from '../../../modules/queue/worker.service.js';
import { requestContext } from '../../../core/context/request-context.js';

const job = (attempts = 1, id = 'j1'): ClaimedJob => ({ id, deliveryId: 'd-1', attempts, lockedAt: new Date() });

function setup(claimed: ClaimedJob[]) {
  const jobs = {
    claim: vi.fn().mockResolvedValueOnce(claimed).mockResolvedValue([]),
    findDelivery: vi.fn().mockResolvedValue(delivery()),
    succeed: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue('failed'),
  };
  const handle = vi.fn().mockResolvedValue(undefined);
  const registry = new HandlerRegistry();
  registry.register({ events: ['issues'], handle });
  const worker = new WorkerService(jobs as unknown as JobRepository, registry);
  // poll() is fire-and-forget; shutdown waits for the batch in flight.
  const tick = async () => {
    worker.poll();
    await worker.beforeApplicationShutdown();
  };
  return { worker, jobs, handle, tick };
}

describe('WorkerService', () => {
  it('runs each job inside its own context, so log lines carry its delivery and job ids', async () => {
    const { handle, tick } = setup([job(1, 'a'), job(1, 'b')]);
    const seen: unknown[] = [];
    handle.mockImplementation(async () => seen.push(requestContext.get()));
    await tick();
    expect(seen).toEqual([
      { deliveryId: 'd-1', jobId: 'a' },
      { deliveryId: 'd-1', jobId: 'b' },
    ]);
  });

  it('runs the handler for each claimed job and marks it succeeded', async () => {
    const { jobs, handle, tick } = setup([job(1, 'a'), job(1, 'b')]);
    await tick();
    expect(jobs.claim).toHaveBeenCalledWith(5);
    expect(handle).toHaveBeenCalledTimes(2);
    expect(jobs.succeed).toHaveBeenCalledTimes(2);
  });

  it('records a handler failure on the job', async () => {
    const { jobs, handle, tick } = setup([job()]);
    const err = new Error('GitHub down');
    handle.mockRejectedValue(err);
    await tick();
    expect(jobs.fail).toHaveBeenCalledWith(expect.objectContaining({ id: 'j1' }), err);
    expect(jobs.succeed).not.toHaveBeenCalled();
  });

  it.each([
    ['the delivery is missing', (s: ReturnType<typeof setup>) => s.jobs.findDelivery.mockResolvedValue(null), 'delivery missing'],
    ['no handler exists', (s: ReturnType<typeof setup>) => s.jobs.findDelivery.mockResolvedValue(delivery({ event: 'star' })), 'no handler for star'],
  ])('dead-letters when %s', async (_name, arrange, message) => {
    const s = setup([job()]);
    arrange(s);
    await s.tick();
    const err = s.jobs.fail.mock.calls[0][1];
    expect(err).toBeInstanceOf(PermanentJobError);
    expect(err.message).toBe(message);
  });

  it('stops a job that crash-looped past the attempt limit', async () => {
    const { jobs, handle, tick } = setup([job(6)]);
    await tick();
    expect(handle).not.toHaveBeenCalled();
    expect(jobs.fail.mock.calls[0][1]).toBeInstanceOf(PermanentJobError);
  });

  it('does not start a second batch while one is in flight', async () => {
    const { worker, jobs } = setup([]);
    let release!: () => void;
    jobs.claim.mockReset().mockReturnValue(new Promise((r) => (release = () => r([]))));
    worker.poll();
    worker.poll();
    release();
    await worker.beforeApplicationShutdown();
    expect(jobs.claim).toHaveBeenCalledTimes(1);
  });

  it('stops claiming after shutdown begins', async () => {
    const { worker, jobs } = setup([]);
    await worker.beforeApplicationShutdown();
    worker.poll();
    expect(jobs.claim).not.toHaveBeenCalled();
  });

  it('survives a failed claim', async () => {
    const { jobs, tick } = setup([]);
    jobs.claim.mockReset().mockRejectedValue(new Error('db down'));
    await expect(tick()).resolves.toBeUndefined();
  });
});
