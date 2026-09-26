import { AsyncLocalStorage } from 'node:async_hooks';

// Correlation ids for the current HTTP request or job. The logger adds them to every line.
export interface RequestContext {
  requestId?: string;
  deliveryId?: string;
  jobId?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run({ ...ctx }, fn);
  },

  get(): RequestContext | undefined {
    return storage.getStore();
  },

  // Adds ids to the current context, e.g. the delivery id once webhook headers are validated. No-op outside one.
  set(ids: Partial<RequestContext>): void {
    const store = storage.getStore();
    if (store) Object.assign(store, ids);
  },
};
