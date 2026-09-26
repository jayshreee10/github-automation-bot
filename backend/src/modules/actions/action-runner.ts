import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { RepoEvent } from '../events/repo-event.js';
import type { RuleAction } from '../rules/rule.schema.js';
import { ActionsRepository } from './actions.repository.js';
import { PermanentActionError, toActionError } from './errors.js';
import { GithubActions, type IssueRef } from './github-actions.js';
import { SlackNotifier } from './slack-notifier.js';

// Allows for clock skew between our database and GitHub when searching for an earlier comment.
const COMMENT_LOOKBACK_MS = 60_000;

export interface ActionContext {
  event: RepoEvent;
  installationId: number;
  ruleId: string;
  ruleName: string;
}

// done: already succeeded or failed earlier. retry: transient failure, the job should run again.
export type ActionOutcome = 'succeeded' | 'done' | 'failed' | 'retry';

@Injectable()
export class ActionRunner {
  private readonly logger = new Logger(ActionRunner.name);

  constructor(
    private readonly actions: ActionsRepository,
    private readonly github: GithubActions,
    private readonly slack: SlackNotifier,
  ) {}

  // Runs one action at most once per delivery and rule; its row records the outcome.
  async run(ctx: ActionContext, action: RuleAction): Promise<ActionOutcome> {
    const row = await this.actions.ensure({
      deliveryId: ctx.event.deliveryId,
      ruleId: ctx.ruleId,
      type: action.type,
    });
    if (row.status !== 'pending') return 'done';

    const label = `Delivery ${ctx.event.deliveryId} rule ${ctx.ruleId} ${action.type}`;
    await this.actions.begin(row.id);
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    try {
      const retrying = row.attempts > 0;
      const result = await this.execute(ctx, action, retrying, row.createdAt);
      await this.actions.succeed(row.id, result, elapsed());
      this.logger.log(`${label}: succeeded`);
      return 'succeeded';
    } catch (err) {
      const error = toActionError(err);
      const permanent = error instanceof PermanentActionError;
      await this.actions.fail(row.id, error.message, permanent, elapsed());
      this.logger.warn(
        `${label}: ${permanent ? 'failed' : 'will retry'} (${error.message})`,
      );
      return permanent ? 'failed' : 'retry';
    }
  }

  private async execute(
    ctx: ActionContext,
    action: RuleAction,
    retrying: boolean,
    createdAt: Date,
  ): Promise<Prisma.InputJsonValue> {
    switch (action.type) {
      case 'add_label':
        return {
          labels: await this.github.addLabels(issueRef(ctx), action.labels),
        };
      case 'add_comment': {
        const ref = issueRef(ctx);
        const marker = `<!-- bot:${ctx.event.deliveryId}:${ctx.ruleId} -->`;
        // A crash after posting but before saving would repeat the comment; look for our marker first.
        if (retrying) {
          const since = new Date(createdAt.getTime() - COMMENT_LOOKBACK_MS);
          const found = await this.github.findComment(ref, marker, since);
          if (found) return { ...found, recovered: true };
        }
        const body = `${render(action.body, ctx.event)}\n\n${marker}`;
        return this.github.addComment(ref, body);
      }
      case 'slack_notify':
        await this.slack.notify(ctx.event, ctx.ruleName);
        return {};
    }
  }
}

function issueRef(ctx: ActionContext): IssueRef {
  if (ctx.event.number === null)
    throw new PermanentActionError(`${ctx.event.event} has no issue or PR`);
  return {
    installationId: ctx.installationId,
    repoFullName: ctx.event.repository.fullName,
    number: ctx.event.number,
  };
}

// Fixed placeholders only; no template engine, so rule text can never run code.
function render(template: string, event: RepoEvent): string {
  return template
    .replaceAll('{author}', event.actor)
    .replaceAll('{title}', event.title)
    .replaceAll('{url}', event.url ?? '');
}
