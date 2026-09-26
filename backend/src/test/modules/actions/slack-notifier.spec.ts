import { describe, expect, it, vi } from 'vitest';
import { repoEvent } from '../../fakes.js';
import { PermanentActionError } from '../../../modules/actions/errors.js';
import { SlackNotifier } from '../../../modules/actions/slack-notifier.js';
import { SecretBoxError } from '../../../modules/slack/secret-box.js';
import type { SlackSettingsService, SlackTarget } from '../../../modules/slack/slack-settings.service.js';
import { escapeSlack, SlackApiError } from '../../../modules/slack/slack-webhook.js';

const URL = 'https://hooks.slack.com/services/T0/B0/xyz';
const TARGET: SlackTarget = { url: URL, includeLink: true, channelLabel: null };

function setup(status = 200, target: SlackTarget | null = TARGET) {
  const fetch = vi.fn().mockResolvedValue(new Response('ok', { status }));
  vi.stubGlobal('fetch', fetch);
  const settings = { target: vi.fn().mockResolvedValue(target) };
  const notifier = new SlackNotifier(settings as unknown as SlackSettingsService);
  const sent = () => JSON.parse(fetch.mock.calls[0][1].body);
  return { fetch, notifier, settings, sent };
}

describe('escapeSlack', () => {
  it('escapes Slack control characters so payload text cannot ping', () => {
    expect(escapeSlack('<!channel> & <@U1>')).toBe('&lt;!channel&gt; &amp; &lt;@U1&gt;');
  });
});

describe('SlackNotifier', () => {
  it("posts a Block Kit message to the owner's webhook", async () => {
    const { fetch, notifier, settings, sent } = setup();
    await notifier.notify(repoEvent(), 'Bugs', 'user-1');
    expect(settings.target).toHaveBeenCalledWith('user-1');
    expect(fetch.mock.calls[0][0]).toBe(URL);
    const body = sent();
    expect(body.text).toBe('octo/repo: #7 bug: crash on save');
    expect(body.blocks[0].text.text).toBe('*<https://github.com/octo/repo/issues/7|#7 bug: crash on save>*');
    expect(body.blocks[1].elements[0].text).toBe('*octo/repo* · `issues.opened` · by alice · rule: Bugs');
  });

  it('leaves the title unlinked when the owner turned links off', async () => {
    const { notifier, sent } = setup(200, { ...TARGET, includeLink: false });
    await notifier.notify(repoEvent(), 'Bugs', 'user-1');
    expect(sent().blocks[0].text.text).toBe('*#7 bug: crash on save*');
  });

  it('escapes user-controlled text', async () => {
    const { notifier, sent } = setup();
    await notifier.notify(repoEvent({ title: '<!here> urgent', actor: 'a&b' }), '<rule>', 'user-1');
    const text = JSON.stringify(sent());
    expect(text).not.toContain('<!here>');
    expect(text).toContain('&lt;!here&gt;');
    expect(text).toContain('rule: &lt;rule&gt;');
  });

  it('formats a push without number, action or link', async () => {
    const { notifier, sent } = setup();
    await notifier.notify(repoEvent({ event: 'push', action: null, number: null, title: '', url: null }), 'r', 'user-1');
    const body = sent();
    expect(body.blocks[0].text.text).toBe('*(no title)*');
    expect(body.blocks[1].elements[0].text).toContain('`push`');
  });

  it('fails permanently when no webhook is configured', async () => {
    const { fetch, notifier } = setup(200, null);
    await expect(notifier.notify(repoEvent(), 'r', 'user-1')).rejects.toBeInstanceOf(PermanentActionError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails permanently when the stored webhook cannot be decrypted', async () => {
    const { notifier, settings } = setup();
    settings.target.mockRejectedValue(new SecretBoxError('secret could not be decrypted'));
    await expect(notifier.notify(repoEvent(), 'r', 'user-1')).rejects.toBeInstanceOf(PermanentActionError);
  });

  it('throws SlackApiError with the status on a non-2xx reply', async () => {
    const { notifier } = setup(500);
    await expect(notifier.notify(repoEvent(), 'r', 'user-1')).rejects.toEqual(new SlackApiError(500));
  });
});
