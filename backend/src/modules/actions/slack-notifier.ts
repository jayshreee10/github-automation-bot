import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../core/config/config.service.js';
import type { RepoEvent } from '../events/repo-event.js';
import { PermanentActionError, SlackApiError } from './errors.js';

// Slack treats &, < and > as control characters; escaping them stops payload text like <!channel> pinging anyone.
export function escapeSlack(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// Posts one Block Kit message per matched rule through the workspace Incoming Webhook.
@Injectable()
export class SlackNotifier {
  private readonly url: string | undefined;

  constructor(config: ConfigService) {
    this.url = config.get('SLACK_WEBHOOK_URL');
  }

  async notify(event: RepoEvent, ruleName: string): Promise<void> {
    if (!this.url)
      throw new PermanentActionError('SLACK_WEBHOOK_URL is not configured');
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message(event, ruleName)),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new SlackApiError(res.status);
  }
}

function message(event: RepoEvent, ruleName: string) {
  const kind = event.action ? `${event.event}.${event.action}` : event.event;
  const label = event.number ? `#${event.number} ${event.title}` : event.title;
  const title = escapeSlack(label || '(no title)');
  const link = event.url ? `<${event.url}|${title}>` : title;
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
