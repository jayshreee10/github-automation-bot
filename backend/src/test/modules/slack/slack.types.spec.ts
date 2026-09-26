import { describe, expect, it } from 'vitest';
import { slackWebhookUrlSchema } from '../../../modules/slack/slack.types.js';

describe('slackWebhookUrlSchema', () => {
  it('accepts Slack incoming webhook URLs', () => {
    expect(slackWebhookUrlSchema.safeParse('https://hooks.slack.com/services/T0/B0/xyz').success).toBe(true);
  });

  it.each([
    'http://hooks.slack.com/services/T0/B0/xyz',
    'https://evil.example.com/services/T0/B0/xyz',
    'https://hooks.slack.com.evil.com/services/x',
    'https://hooks.slack.com/workflows/x',
    'not a url',
  ])('rejects %s', (url) => {
    expect(slackWebhookUrlSchema.safeParse(url).success).toBe(false);
  });
});
