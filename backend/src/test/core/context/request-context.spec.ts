import { describe, expect, it } from 'vitest';
import { requestContext } from '../../../core/context/request-context.js';

describe('requestContext', () => {
  it('is empty outside a run, and set() is then a no-op', () => {
    requestContext.set({ deliveryId: 'd' });
    expect(requestContext.get()).toBeUndefined();
  });

  it('keeps ids across awaits and lets later code add ids', async () => {
    await requestContext.run({ requestId: 'r' }, async () => {
      await Promise.resolve();
      requestContext.set({ deliveryId: 'd' });
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(requestContext.get()).toEqual({ requestId: 'r', deliveryId: 'd' });
    });
  });

  it('isolates concurrent runs', async () => {
    const seen = await Promise.all(
      ['a', 'b'].map((jobId) =>
        requestContext.run({ jobId }, async () => {
          await new Promise((resolve) => setTimeout(resolve, jobId === 'a' ? 5 : 1));
          return requestContext.get()?.jobId;
        }),
      ),
    );
    expect(seen).toEqual(['a', 'b']);
  });

  it('copies the initial ids, so set() never leaks into the caller object', () => {
    const initial = { requestId: 'r' };
    requestContext.run(initial, () => requestContext.set({ userId: 'u' }));
    expect(initial).toEqual({ requestId: 'r' });
  });
});
