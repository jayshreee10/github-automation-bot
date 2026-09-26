import { Injectable } from '@nestjs/common';
import type { RepoEvent } from '../events/repo-event.js';
import { SecretBoxError } from '../slack/secret-box.js';
import {
  SlackSettingsService,
  type SlackTarget,
} from '../slack/slack-settings.service.js';
import { escapeSlack, postToSlack } from '../slack/slack-webhook.js';
import { PermanentActionError } from './errors.js';

// Posts one Block Kit message per matched rule to the webhook the repo owner saved in Settings.
@Injectable()
export class SlackNotifier {
  constructor(private readonly settings: SlackSettingsService) {}

  async notify(
    event: RepoEvent,
    ruleName: string,
    ownerId: string,
  ): Promise<void> {
    const target = await this.targetFor(ownerId);
    await postToSlack(target.url, message(event, ruleName, target));
  }

  // Missing or undecryptable config will not fix itself on retry, so both fail permanently.
  private async targetFor(ownerId: string): Promise<SlackTarget> {
    let target: SlackTarget | null;
    try {
      target = await this.settings.target(ownerId);
    } catch (err) {
      if (err instanceof SecretBoxError)
        throw new PermanentActionError(
          `Slack webhook unusable: ${err.message}`,
        );
      throw err;
    }
    if (!target)
      throw new PermanentActionError(
        'no Slack webhook saved; add one in Settings',
      );
    return target;
  }
}

function message(event: RepoEvent, ruleName: string, target: SlackTarget) {
  const kind = event.action ? `${event.event}.${event.action}` : event.event;
  const label = event.number ? `#${event.number} ${event.title}` : event.title;
  const title = escapeSlack(label || '(no title)');
  const link =
    event.url && target.includeLink ? `<${event.url}|${title}>` : title;
  const text = `${escapeSlack(event.repository.fullName)}: ${title}`;
  return {
    text,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${link}*` },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: [
              `*${escapeSlack(event.repository.fullName)}*`,
              `\`${escapeSlack(kind)}\``,
              `by ${escapeSlack(event.actor)}`,
              `rule: ${escapeSlack(ruleName)}`,
            ].join(' · '),
          },
        ],
      },
    ],
  };
}
