import { Module } from '@nestjs/common';
import { SecretBox } from './secret-box.js';
import { SlackSettingsRepository } from './slack-settings.repository.js';
import { SlackSettingsService } from './slack-settings.service.js';
import { SlackController } from './slack.controller.js';

@Module({
  controllers: [SlackController],
  providers: [SecretBox, SlackSettingsRepository, SlackSettingsService],
  exports: [SlackSettingsService],
})
export class SlackModule {}
