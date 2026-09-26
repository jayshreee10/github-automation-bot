import { Injectable, Logger } from '@nestjs/common';
import {
  InvalidInputError,
  UpstreamUnavailableError,
} from '../../core/errors/domain.error.js';
import { errorMessage } from '../../core/errors/error-message.js';
import type { SlackSettings as SlackSettingsRow } from '../../generated/prisma/client.js';
import { SecretBox } from './secret-box.js';
import {
  type SlackSettingsChange,
  SlackSettingsRepository,
} from './slack-settings.repository.js';
import { escapeSlack, postToSlack, SlackApiError } from './slack-webhook.js';
import type {
  SlackSettings,
  TestSlackBody,
  UpdateSlackSettingsBody,
} from './slack.types.js';

// Where one user's Slack messages go, and how they look.
export interface SlackTarget {
  url: string;
  includeLink: boolean;
  channelLabel: string | null;
}

// Each user saves their own Incoming Webhook; no webhook means no Slack. The stored URL never leaves the server.
@Injectable()
export class SlackSettingsService {
  private readonly logger = new Logger(SlackSettingsService.name);

  constructor(
    private readonly repo: SlackSettingsRepository,
    private readonly box: SecretBox,
  ) {}

  async get(userId: string): Promise<SlackSettings> {
    return this.toDto(await this.repo.find(userId));
  }

  async update(
    userId: string,
    body: UpdateSlackSettingsBody,
  ): Promise<SlackSettings> {
    const change: SlackSettingsChange = {
      channelLabel: body.channelLabel === '' ? null : body.channelLabel,
      includeLink: body.includeLink,
    };
    if (body.webhookUrl === null) {
      change.webhookCipher = null;
      change.webhookLast4 = null;
    } else if (body.webhookUrl !== undefined) {
      change.webhookCipher = this.box.seal(body.webhookUrl, userId);
      change.webhookLast4 = body.webhookUrl.slice(-4);
    }
    return this.toDto(await this.repo.upsert(userId, change));
  }

  // Null when the user saved no webhook. Throws SecretBoxError when the stored one can no longer be decrypted.
  async target(userId: string): Promise<SlackTarget | null> {
    const row = await this.repo.find(userId);
    if (!row?.webhookCipher) return null;
    return {
      url: this.box.open(row.webhookCipher, userId),
      includeLink: row.includeLink,
      channelLabel: row.channelLabel,
    };
  }

  // Sends a short message so the user can see the webhook works. Slack's 4xx means the URL is wrong.
  async sendTest(userId: string, body: TestSlackBody): Promise<void> {
    const saved = body.webhookUrl ? null : await this.target(userId);
    const url = body.webhookUrl ?? saved?.url;
    if (!url) throw new InvalidInputError('add a Slack webhook URL first');
    const label = saved?.channelLabel;
    const text = `:white_check_mark: Test message from Automation Bot${label ? ` for ${escapeSlack(label)}` : ''}. Rule notifications will arrive here.`;
    try {
      await postToSlack(url, { text });
    } catch (err) {
      if (err instanceof SlackApiError && err.status >= 400 && err.status < 500)
        throw new InvalidInputError(
          `Slack rejected the webhook (${err.status})`,
        );
      this.logger.warn(`Slack test failed: ${errorMessage(err)}`);
      throw new UpstreamUnavailableError();
    }
  }

  private toDto(row: SlackSettingsRow | null): SlackSettings {
    const connected = Boolean(row?.webhookCipher);
    return {
      connected,
      webhookLast4: connected ? (row?.webhookLast4 ?? null) : null,
      channelLabel: row?.channelLabel ?? null,
      includeLink: row?.includeLink ?? true,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }
}
