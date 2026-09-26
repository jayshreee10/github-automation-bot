import { Injectable, Logger } from '@nestjs/common';
import { NotFoundError } from '../../core/errors/domain.error.js';
import { errorMessage } from '../../core/errors/error-message.js';
import { GithubService } from '../github/github.service.js';
import { MAX_ATTEMPTS } from '../queue/queue.constants.js';
import {
  ruleActionSchema,
  ruleConditionsSchema,
  ruleEventSchema,
} from '../rules/rule.schema.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { toEventSummary } from './event-summary.js';
import {
  type EventFilter,
  type EventRow,
  EventsRepository,
} from './events.repository.js';
import type {
  EventDetail,
  EventItem,
  EventListQuery,
  EventPage,
  Stats,
} from './events.types.js';

// The dashboard polls every few seconds; the App's webhook config rarely changes, so ask GitHub at most once a minute.
const HOOK_CONFIG_TTL_MS = 60_000;

type ActionChip = EventItem['actions'][number];
type DetailRule = EventDetail['rules'][number];

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private hookCache?: { configured: boolean; at: number };

  constructor(
    private readonly events: EventsRepository,
    private readonly github: GithubService,
  ) {}

  // Newest first. One extra row is fetched to know whether an older page exists; the first page also counts.
  async list(userId: string, q: EventListQuery): Promise<EventPage> {
    const filter: EventFilter = {
      repositoryId: toBigInt(q.repositoryId),
      event: q.event,
      status: q.status,
      q: q.q,
    };
    const firstPage = q.before === undefined;
    const [rows, total] = await Promise.all([
      this.events.list(
        userId,
        {
          ...filter,
          before: q.before === undefined ? undefined : decodeCursor(q.before),
        },
        q.limit + 1,
      ),
      firstPage ? this.events.count(userId, filter) : null,
    ]);
    const page = rows.slice(0, q.limit);
    const chips = await this.chipsFor(page.map((r) => r.id));
    const last = page.at(-1);
    return {
      items: page.map((r) => toItem(r, chips.get(r.id) ?? [])),
      nextCursor:
        rows.length > q.limit && last
          ? encodeCursor({ receivedAt: last.receivedAt, id: last.id })
          : null,
      total,
    };
  }

  // Unknown and another user's delivery both return 404.
  async detail(userId: string, deliveryId: string): Promise<EventDetail> {
    const row = await this.events.findForUser(userId, deliveryId);
    if (!row) throw new NotFoundError(`delivery ${deliveryId}`);
    const actions = await this.events.actionDetails(deliveryId);
    const base = toItem(row, []);
    return {
      ...base,
      job:
        row.jobId && row.jobStatus && row.jobNextRunAt && row.jobUpdatedAt
          ? {
              id: row.jobId,
              status: row.jobStatus,
              attempts: row.jobAttempts ?? 0,
              maxAttempts: MAX_ATTEMPTS,
              nextRunAt: row.jobNextRunAt.toISOString(),
              lastError: row.jobLastError,
              updatedAt: row.jobUpdatedAt.toISOString(),
            }
          : null,
      actions: actions.map((a) => ({
        id: a.id,
        ruleId: a.ruleId,
        ruleName: a.rule.name,
        type: a.type,
        status: a.status,
        attempts: a.attempts,
        result: isRecord(a.result) ? a.result : null,
        error: a.error,
        durationMs: a.durationMs,
        updatedAt: a.updatedAt.toISOString(),
      })),
      rules: detailRules(actions),
    };
  }

  async stats(userId: string, repositoryId?: string): Promise<Stats> {
    const [row, configured] = await Promise.all([
      this.events.stats(userId, toBigInt(repositoryId)),
      this.hookConfigured(),
    ]);
    return {
      events: row.events,
      eventsPrevious: row.eventsPrevious,
      actionsSucceeded: row.actionsSucceeded,
      actionsFailed: row.actionsFailed,
      actionsByType: {
        add_label: row.labelsAdded,
        add_comment: row.commentsPosted,
        slack_notify: row.slackSent,
      },
      jobsDead: row.jobsDead,
      jobs: {
        pending: row.jobsPending,
        retrying: row.jobsRetrying,
        dead: row.jobsDeadTotal,
        succeeded: row.jobsSucceeded,
      },
      recoveredDeliveries: row.recoveredDeliveries,
      webhook: {
        configured,
        lastDeliveryAt: row.lastDeliveryAt?.toISOString() ?? null,
      },
    };
  }

  private async chipsFor(ids: string[]): Promise<Map<string, ActionChip[]>> {
    const byDelivery = new Map<string, ActionChip[]>();
    if (!ids.length) return byDelivery;
    for (const a of await this.events.actionsFor(ids)) {
      const list = byDelivery.get(a.deliveryId) ?? [];
      list.push({
        type: a.type,
        status: a.status,
        labels: a.type === 'add_label' ? ruleLabels(a.rule.actions) : null,
      });
      byDelivery.set(a.deliveryId, list);
    }
    return byDelivery;
  }

  private async hookConfigured(): Promise<boolean | null> {
    if (this.hookCache && Date.now() - this.hookCache.at < HOOK_CONFIG_TTL_MS)
      return this.hookCache.configured;
    try {
      const configured = await this.github.hookConfigured();
      this.hookCache = { configured, at: Date.now() };
      return configured;
    } catch (err) {
      this.logger.warn(`Webhook config check failed: ${errorMessage(err)}`);
      return null;
    }
  }
}

function toItem(row: EventRow, actions: ActionChip[]): EventItem {
  return {
    id: row.id,
    event: row.event,
    action: row.action,
    repository: {
      id: row.repositoryId.toString(),
      fullName: row.repositoryName,
    },
    summary: toEventSummary(row),
    job:
      row.jobId && row.jobStatus
        ? {
            id: row.jobId,
            status: row.jobStatus,
            attempts: row.jobAttempts ?? 0,
            maxAttempts: MAX_ATTEMPTS,
          }
        : null,
    actions,
    receivedAt: row.receivedAt.toISOString(),
  };
}

// Labels configured on the rule's add_label action; null if the stored rule no longer parses.
function ruleLabels(actions: unknown): string[] | null {
  const parsed = ruleActionSchema.array().safeParse(actions);
  if (!parsed.success) return null;
  const label = parsed.data.find((a) => a.type === 'add_label');
  return label?.labels ?? null;
}

// One entry per rule, in action order; a rule whose stored definition no longer parses is left out.
function detailRules(
  actions: {
    ruleId: string;
    rule: { name: string; event: string; conditions: unknown };
  }[],
): DetailRule[] {
  const rules = new Map<string, DetailRule | null>();
  for (const { ruleId, rule } of actions) {
    if (rules.has(ruleId)) continue;
    const event = ruleEventSchema.safeParse(rule.event);
    const conditions = ruleConditionsSchema.safeParse(rule.conditions);
    rules.set(
      ruleId,
      event.success && conditions.success
        ? {
            id: ruleId,
            name: rule.name,
            event: event.data,
            conditions: conditions.data,
          }
        : null,
    );
  }
  return [...rules.values()].filter((r) => r !== null);
}

function toBigInt(id: string | undefined): bigint | undefined {
  return id === undefined ? undefined : BigInt(id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
