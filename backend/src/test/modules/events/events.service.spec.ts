import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../core/errors/domain.error.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../core/database/prisma.service.js';
import type { GithubService } from '../../../modules/github/github.service.js';
import { decodeCursor, encodeCursor } from '../../../modules/events/cursor.js';
import { type EventRow, EventsRepository } from '../../../modules/events/events.repository.js';
import { EventsService } from '../../../modules/events/events.service.js';
import {
  eventDetailSchema,
  eventListQuerySchema,
  eventPageSchema,
  statsSchema,
} from '../../../modules/events/events.types.js';

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const row = (n: number, overrides: Partial<EventRow> = {}): EventRow => ({
  id: ID(n),
  event: 'issues',
  action: 'opened',
  repositoryId: 42n,
  repositoryName: 'octo/repo',
  receivedAt: new Date(`2026-01-0${n}T00:00:00Z`),
  summaryTitle: 'bug: crash',
  summaryNumber: '7',
  summaryUrl: 'https://github.com/octo/repo/issues/7',
  summaryAuthor: 'alice',
  summaryRef: null,
  jobId: `job-${n}`,
  jobStatus: 'succeeded',
  jobAttempts: 1,
  jobNextRunAt: new Date('2026-01-01T00:00:00Z'),
  jobLastError: null,
  jobUpdatedAt: new Date('2026-01-01T00:01:00Z'),
  ...overrides,
});

const query = (q: object = {}) => eventListQuerySchema.parse(q);

function setup(rows: EventRow[] = []) {
  const events = {
    list: vi.fn().mockResolvedValue(rows),
    count: vi.fn().mockResolvedValue(rows.length),
    findForUser: vi.fn().mockResolvedValue(rows[0] ?? null),
    actionsFor: vi.fn().mockResolvedValue([]),
    actionDetails: vi.fn().mockResolvedValue([]),
    stats: vi.fn().mockResolvedValue({
      events: 3,
      eventsPrevious: 1,
      actionsSucceeded: 5,
      actionsFailed: 1,
      labelsAdded: 2,
      commentsPosted: 1,
      slackSent: 2,
      jobsDead: 0,
      jobsPending: 1,
      jobsRetrying: 2,
      jobsDeadTotal: 1,
      jobsSucceeded: 4,
      recoveredDeliveries: 2,
      lastDeliveryAt: new Date('2026-01-03T00:00:00Z'),
    }),
  };
  const github = { hookConfigured: vi.fn().mockResolvedValue(true) };
  const service = new EventsService(events as unknown as EventsRepository, github as unknown as GithubService);
  return { service, events, github };
}

describe('EventsService.list', () => {
  it('returns one page, newest first, with a cursor when more rows exist', async () => {
    const { service, events } = setup([row(3), row(2), row(1)]);
    const page = await service.list('user-1', query({ limit: 2 }));
    expect(events.list).toHaveBeenCalledWith('user-1', expect.objectContaining({ before: undefined }), 3);
    expect(page.items.map((i) => i.id)).toEqual([ID(3), ID(2)]);
    expect(decodeCursor(page.nextCursor!)).toEqual({ receivedAt: row(2).receivedAt, id: ID(2) });
    expect(page.total).toBe(3);
    expect(page.items[0].job).toMatchObject({ attempts: 1, maxAttempts: 5 });
    expect(eventPageSchema.safeParse(page).success).toBe(true);
  });

  it('counts only on the first page, with the same filters and no cursor', async () => {
    const { service, events } = setup([row(1)]);
    await service.list('u', query({ q: 'bug', event: 'issues' }));
    expect(events.count).toHaveBeenCalledWith('u', { repositoryId: undefined, event: 'issues', status: undefined, q: 'bug' });

    events.count.mockClear();
    const before = encodeCursor({ receivedAt: new Date('2026-01-05T00:00:00Z'), id: ID(5) });
    expect((await service.list('u', query({ before }))).total).toBeNull();
    expect(events.count).not.toHaveBeenCalled();
  });

  it('has no cursor on the last page and skips the actions query when empty', async () => {
    const { service, events } = setup();
    expect(await service.list('u', query())).toEqual({ items: [], nextCursor: null, total: 0 });
    expect(events.actionsFor).not.toHaveBeenCalled();
  });

  it('passes filters and the decoded cursor to the repository', async () => {
    const { service, events } = setup();
    const before = encodeCursor({ receivedAt: new Date('2026-01-05T00:00:00Z'), id: ID(5) });
    await service.list('u', query({ repositoryId: '42', event: 'push', status: 'dead', before }));
    expect(events.list).toHaveBeenCalledWith(
      'u',
      { repositoryId: 42n, event: 'push', status: 'dead', q: undefined, before: decodeCursor(before) },
      26,
    );
  });

  it('attaches action chips per delivery and a trimmed summary, never the payload', async () => {
    const { service, events } = setup([row(2), row(1, { jobId: null, jobStatus: null })]);
    const ruleActions = [{ type: 'add_label', labels: ['bug'] }, { type: 'slack_notify' }];
    events.actionsFor.mockResolvedValue([
      { deliveryId: ID(2), type: 'add_label', status: 'succeeded', rule: { actions: ruleActions } },
      { deliveryId: ID(2), type: 'slack_notify', status: 'failed', rule: { actions: ruleActions } },
    ]);
    const { items } = await service.list('u', query());
    expect(items[0].actions).toEqual([
      { type: 'add_label', status: 'succeeded', labels: ['bug'] },
      { type: 'slack_notify', status: 'failed', labels: null },
    ]);
    expect(items[1]).toMatchObject({ actions: [], job: null });
    expect(items[0].summary.title).toBe('bug: crash');
    expect(JSON.stringify(items)).not.toContain('payload');
  });
});

describe('EventsService.detail', () => {
  it('returns 404 for an unknown or foreign delivery', async () => {
    const { service } = setup();
    await expect(service.detail('u', ID(1))).rejects.toThrow(NotFoundError);
  });

  it('includes the job and each action with rule name, result and error', async () => {
    const { service, events } = setup([row(1, { jobStatus: 'failed', jobLastError: 'Error: timeout' })]);
    events.actionDetails.mockResolvedValue([
      {
        id: 'a1',
        ruleId: 'r1',
        rule: { name: 'Bugs', event: 'issues', conditions: { titleContains: ['bug'] } },
        type: 'slack_notify',
        status: 'failed',
        attempts: 2,
        result: null,
        error: 'Slack webhook 404',
        durationMs: 340,
        updatedAt: new Date('2026-01-01T00:02:00Z'),
      },
      {
        id: 'a2',
        ruleId: 'r1',
        rule: { name: 'Bugs', event: 'issues', conditions: { titleContains: ['bug'] } },
        type: 'add_label',
        status: 'succeeded',
        attempts: 1,
        result: { labels: ['bug'] },
        error: null,
        durationMs: null,
        updatedAt: new Date('2026-01-01T00:02:00Z'),
      },
      {
        id: 'a3',
        ruleId: 'broken',
        rule: { name: 'Old', event: 'issues', conditions: { match: 'some' } },
        type: 'add_comment',
        status: 'succeeded',
        attempts: 1,
        result: null,
        error: null,
        durationMs: null,
        updatedAt: new Date('2026-01-01T00:02:00Z'),
      },
    ]);
    const detail = await service.detail('u', ID(1));
    expect(detail.job).toMatchObject({ status: 'failed', lastError: 'Error: timeout', maxAttempts: 5 });
    expect(detail.actions[0]).toMatchObject({ ruleName: 'Bugs', error: 'Slack webhook 404', result: null, durationMs: 340 });
    expect(detail.rules).toEqual([
      { id: 'r1', name: 'Bugs', event: 'issues', conditions: expect.objectContaining({ match: 'all', titleContains: ['bug'] }) },
    ]);
    expect(eventDetailSchema.safeParse(detail).success).toBe(true);
  });
});

describe('EventsService.stats', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns counts and webhook status for the repo filter', async () => {
    const { service, events } = setup();
    const stats = await service.stats('u', '42');
    expect(events.stats).toHaveBeenCalledWith('u', 42n);
    expect(stats.webhook).toEqual({ configured: true, lastDeliveryAt: '2026-01-03T00:00:00.000Z' });
    expect(stats).toMatchObject({
      eventsPrevious: 1,
      actionsByType: { add_label: 2, add_comment: 1, slack_notify: 2 },
      jobs: { pending: 1, retrying: 2, dead: 1, succeeded: 4 },
      recoveredDeliveries: 2,
    });
    expect(statsSchema.safeParse(stats).success).toBe(true);
  });

  it('reports configured as null when GitHub cannot be asked', async () => {
    const { service, github } = setup();
    github.hookConfigured.mockRejectedValue(new Error('down'));
    expect((await service.stats('u')).webhook.configured).toBeNull();
  });

  it('asks GitHub at most once a minute', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const { service, github } = setup();
    await service.stats('u');
    vi.advanceTimersByTime(59_000);
    await service.stats('u');
    expect(github.hookConfigured).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    await service.stats('u');
    expect(github.hookConfigured).toHaveBeenCalledTimes(2);
  });
});

// Rebuilds the tagged-template call so the final SQL text and bound values can be checked.
function capturedSql(queryRaw: ReturnType<typeof vi.fn>) {
  const [strings, ...values] = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
}

describe('EventsRepository SQL', () => {
  function repo() {
    const $queryRaw = vi.fn().mockResolvedValue([]);
    return { $queryRaw, events: new EventsRepository({ $queryRaw } as unknown as PrismaService) };
  }

  it('scopes the list to the caller, binds every filter, and pages by keyset', async () => {
    const { $queryRaw, events } = repo();
    const before = { receivedAt: new Date('2026-01-05T00:00:00.000Z'), id: ID(5) };
    await events.list('user-1', { repositoryId: 42n, event: 'issues', status: 'dead', before }, 26);
    const sql = capturedSql($queryRaw);
    expect(sql.text).toContain('i.user_id = $1');
    expect(sql.text).toContain('(d.received_at, d.id) <');
    expect(sql.text).not.toMatch(/OFFSET/i);
    expect(sql.text).not.toMatch(/SELECT[^;]*\bd\.payload\b(?!->)/);
    expect(sql.values).toEqual(['user-1', 42n, 'issues', 'dead', '2026-01-05T00:00:00.000Z', ID(5), 26]);
  });

  it('searches title, author and delivery id prefix with LIKE wildcards escaped', async () => {
    const { $queryRaw, events } = repo();
    await events.list('user-1', { q: '50%_off' }, 26);
    const sql = capturedSql($queryRaw);
    expect(sql.text).toContain('ILIKE');
    expect(sql.values).toEqual(['user-1', '%50\\%\\_off%', '%50\\%\\_off%', '50\\%\\_off%', 26]);
  });

  it('counts with the same scope and filters, without paging', async () => {
    const { $queryRaw, events } = repo();
    $queryRaw.mockResolvedValue([{ total: 7 }]);
    expect(await events.count('user-1', { repositoryId: 42n })).toBe(7);
    const sql = capturedSql($queryRaw);
    expect(sql.text).toContain('i.user_id = $1');
    expect(sql.text).not.toMatch(/LIMIT/);
    expect(sql.values).toEqual(['user-1', 42n]);
  });

  it('adds no filter clauses when none are given', async () => {
    const { $queryRaw, events } = repo();
    await events.list('user-1', {}, 26);
    expect(capturedSql($queryRaw).values).toEqual(['user-1', 26]);
  });

  it('scopes detail and stats to the caller', async () => {
    const { $queryRaw, events } = repo();
    $queryRaw.mockResolvedValue([{}]);
    await events.findForUser('user-1', ID(1));
    await events.stats('user-1', 42n);
    const [detail, stats] = $queryRaw.mock.calls.map(([s, ...v]) => Prisma.sql(s, ...v));
    expect(detail.values).toEqual(['user-1', ID(1), 1]);
    expect(stats.text).toContain('i.user_id = $1');
    expect(stats.values).toEqual(['user-1', 42n]);
  });
});
