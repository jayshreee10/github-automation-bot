import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '../core/config/config.service.js';
import type { Env } from '../core/config/env.js';
import type { RepoEvent } from '../modules/events/repo-event.js';
import type { WebhookDelivery } from '../generated/prisma/client.js';

// ConfigService stand-in: returns only the keys a test sets.
export function fakeConfig(values: Partial<Env>): ConfigService {
  return { get: (key: keyof Env) => values[key] } as unknown as ConfigService;
}

// Minimal HTTP ExecutionContext around a request object.
export function httpContext(request: object): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

export function repoEvent(overrides: Partial<RepoEvent> = {}): RepoEvent {
  return {
    deliveryId: 'd-1',
    event: 'issues',
    action: 'opened',
    repository: { id: 42, fullName: 'octo/repo' },
    actor: 'alice',
    number: 7,
    title: 'bug: crash on save',
    body: 'Steps to reproduce',
    labels: [],
    ref: null,
    url: 'https://github.com/octo/repo/issues/7',
    ...overrides,
  };
}

export function delivery(
  overrides: Partial<WebhookDelivery> = {},
): WebhookDelivery {
  return {
    id: 'd-1',
    event: 'issues',
    action: 'opened',
    repositoryId: 42n,
    payload: {},
    receivedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// GitHub-style JSON response for a mocked fetch.
export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}
