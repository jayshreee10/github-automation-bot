import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../../core/config/config.service.js';
import type { WebhookDelivery } from '../../generated/prisma/client.js';
import { ActionRunner, type ActionOutcome } from '../actions/action-runner.js';
import { ActionsRepository } from '../actions/actions.repository.js';
import { REPO_EVENTS, toRepoEvent } from '../events/repo-event.js';
import { HandlerRegistry } from '../queue/handler.registry.js';
import type { JobHandler } from '../queue/job-handler.js';
import { matches } from './rule-matcher.js';
import { RulesService } from './rules.service.js';

// Repo events → matching rules → actions. Safe to re-run: each action is recorded once per delivery and rule.
@Injectable()
export class RulesEventHandler implements JobHandler, OnModuleInit {
  readonly events = REPO_EVENTS;
  private readonly logger = new Logger(RulesEventHandler.name);
  private readonly botLogin: string;

  constructor(
    private readonly registry: HandlerRegistry,
    private readonly rules: RulesService,
    private readonly actions: ActionsRepository,
    private readonly runner: ActionRunner,
    config: ConfigService,
  ) {
    this.botLogin = `${config.get('GITHUB_APP_SLUG')}[bot]`;
  }

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(delivery: WebhookDelivery): Promise<void> {
    const tag = `Delivery ${delivery.id}`;
    // Installed but never connected through the setup flow: no owner, so nothing to act on.
    if (delivery.repositoryId === null) {
      this.logger.log(`${tag}: repository not connected, skipped`);
      return;
    }
    const event = toRepoEvent(delivery.id, delivery.event, delivery.payload);
    // Loop guard: the bot's own labels and comments must never trigger rules.
    if (event.actor === this.botLogin) {
      this.logger.log(`${tag}: sent by the bot, skipped`);
      return;
    }
    const installationId = await this.actions.installationIdFor(
      delivery.repositoryId,
    );
    if (installationId === null) {
      this.logger.log(`${tag}: repository no longer connected, skipped`);
      return;
    }

    const rules = await this.rules.findActive(
      delivery.repositoryId,
      event.event,
    );
    const matched = rules.filter((rule) => matches(rule, event));
    this.logger.log(`${tag}: ${matched.length}/${rules.length} rules matched`);

    const outcomes: ActionOutcome[] = [];
    for (const rule of matched) {
      const ctx = {
        event,
        installationId,
        ruleId: rule.id,
        ruleName: rule.name,
      };
      for (const action of rule.actions)
        outcomes.push(await this.runner.run(ctx, action));
    }
    // Only transient failures are worth a retry; permanent ones stay failed on their action rows.
    const retry = outcomes.filter((o) => o === 'retry').length;
    if (retry) throw new Error(`${retry} action(s) failed transiently`);
  }
}
