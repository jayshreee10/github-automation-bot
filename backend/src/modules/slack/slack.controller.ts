import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SlackSettingsService } from './slack-settings.service.js';
import {
  type SlackSettings,
  slackSettingsSchema,
  type TestSlackBody,
  testSlackSchema,
  type UpdateSlackSettingsBody,
  updateSlackSettingsSchema,
} from './slack.types.js';

const inputSchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }) as object;

// The caller's own Slack settings. Responses show only the webhook's last 4 characters.
@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings/slack')
export class SlackController {
  constructor(private readonly slack: SlackSettingsService) {}

  @Get()
  @ApiOkResponse({
    description: "The caller's Slack settings",
    standardSchema: slackSettingsSchema,
  })
  get(@CurrentUser() user: AuthUser): Promise<SlackSettings> {
    return this.slack.get(user.id);
  }

  @Put()
  @ApiBody({ schema: inputSchema(updateSlackSettingsSchema) })
  @ApiOkResponse({
    description: 'Saved settings',
    standardSchema: slackSettingsSchema,
  })
  @ApiBadRequestResponse({
    description: 'Not a Slack Incoming Webhook URL',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Body({ schema: updateSlackSettingsSchema }) body: UpdateSlackSettingsBody,
  ): Promise<SlackSettings> {
    return this.slack.update(user.id, body);
  }

  @Post('test')
  @HttpCode(204)
  @ApiBody({ schema: inputSchema(testSlackSchema) })
  @ApiNoContentResponse({ description: 'Slack accepted the test message' })
  @ApiBadRequestResponse({
    description: 'No webhook configured, or Slack rejected it',
  })
  @ApiBadGatewayResponse({ description: 'Slack unavailable' })
  test(
    @CurrentUser() user: AuthUser,
    @Body({ schema: testSlackSchema }) body: TestSlackBody,
  ): Promise<void> {
    return this.slack.sendTest(user.id, body);
  }
}
