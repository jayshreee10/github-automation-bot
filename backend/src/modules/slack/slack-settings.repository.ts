import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';

export interface SlackSettingsChange {
  webhookCipher?: string | null;
  webhookLast4?: string | null;
  channelLabel?: string | null;
  includeLink?: boolean;
}

// All SQL for per-user Slack settings; one row per user.
@Injectable()
export class SlackSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(userId: string) {
    return this.prisma.slackSettings.findUnique({ where: { userId } });
  }

  upsert(userId: string, change: SlackSettingsChange) {
    return this.prisma.slackSettings.upsert({
      where: { userId },
      create: { userId, ...change },
      update: change,
    });
  }
}
