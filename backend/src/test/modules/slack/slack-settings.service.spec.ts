import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { fakeConfig } from '../../fakes.js';
import { InvalidInputError, UpstreamUnavailableError } from '../../../core/errors/domain.error.js';
import type { SlackSettings as Row } from '../../../generated/prisma/client.js';
import { SecretBox } from '../../../modules/slack/secret-box.js';
import type { SlackSettingsRepository } from '../../../modules/slack/slack-settings.repository.js';
import { SlackSettingsService } from '../../../modules/slack/slack-settings.service.js';

const MINE = 'https://hooks.slack.com/services/T1/B1/mine1234';
const OTHER = 'https://hooks.slack.com/services/T2/B2/other999';
const UPDATED = new Date('2026-09-27T10:00:00Z');

function setup() {
  const box = new SecretBox(fakeConfig({ SETTINGS_ENCRYPTION_KEY: randomBytes(32) }));
  let stored: Row | null = null;
  const repo = {
    find: vi.fn(async () => stored),
    upsert: vi.fn(async (userId: string, change: Partial<Row>) => {
      stored = {
        userId,
        webhookCipher: null,
        webhookLast4: null,
        channelLabel: null,
        includeLink: true,
        ...stored,
        ...Object.fromEntries(Object.entries(change).filter(([, v]) => v !== undefined)),
        updatedAt: UPDATED,
      };
      return stored;
    }),
  };
  const service = new SlackSettingsService(repo as unknown as SlackSettingsRepository, box);
  const fetch = vi.fn().mockResolvedValue(new Response('ok'));
  vi.stubGlobal('fetch', fetch);
  return { service, repo, fetch, stored: () => stored };
}

describe('SlackSettingsService', () => {
  it('is not connected, and has no target, until the user saves a webhook', async () => {
    const { service } = setup();
    await expect(service.get('u1')).resolves.toEqual({
      connected: false,
      webhookLast4: null,
      channelLabel: null,
      includeLink: true,
      updatedAt: null,
    });
    await expect(service.target('u1')).resolves.toBeNull();
  });

  it('stores the webhook encrypted and shows only its last 4 characters', async () => {
    const { service, stored } = setup();
    const dto = await service.update('u1', { webhookUrl: MINE, channelLabel: '#eng-alerts', includeLink: false });
    expect(dto).toMatchObject({ connected: true, webhookLast4: '1234', channelLabel: '#eng-alerts', includeLink: false });
    expect(JSON.stringify(dto)).not.toContain('mine1234');
    expect(stored()?.webhookCipher).not.toContain('mine');
    await expect(service.target('u1')).resolves.toEqual({ url: MINE, includeLink: false, channelLabel: '#eng-alerts' });
  });

  it('keeps the webhook when the URL is omitted, replaces it with a new one, and removes it on null', async () => {
    const { service } = setup();
    await service.update('u1', { webhookUrl: MINE });
    expect((await service.update('u1', { includeLink: false })).connected).toBe(true);
    await service.update('u1', { webhookUrl: OTHER });
    expect((await service.target('u1'))?.url).toBe(OTHER);
    expect((await service.update('u1', { webhookUrl: null })).connected).toBe(false);
    await expect(service.target('u1')).resolves.toBeNull();
  });

  it('stores an empty channel label as null', async () => {
    const { service } = setup();
    expect((await service.update('u1', { channelLabel: '' })).channelLabel).toBeNull();
  });

  it('sends a test message to an unsaved URL, or else to the saved webhook', async () => {
    const { service, fetch } = setup();
    await service.sendTest('u1', { webhookUrl: MINE });
    expect(fetch.mock.calls[0][0]).toBe(MINE);
    await service.update('u1', { webhookUrl: OTHER });
    await service.sendTest('u1', {});
    expect(fetch.mock.calls[1][0]).toBe(OTHER);
  });

  it('maps Slack 4xx to invalid input and 5xx to upstream unavailable', async () => {
    const { service, fetch } = setup();
    fetch.mockResolvedValueOnce(new Response('no_service', { status: 404 }));
    await expect(service.sendTest('u1', { webhookUrl: MINE })).rejects.toThrow('Slack rejected the webhook (404)');
    fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(service.sendTest('u1', { webhookUrl: MINE })).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it('refuses to test when no webhook is saved or given', async () => {
    const { service, fetch } = setup();
    await expect(service.sendTest('u1', {})).rejects.toBeInstanceOf(InvalidInputError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
