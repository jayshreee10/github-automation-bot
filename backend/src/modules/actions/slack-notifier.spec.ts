import { describe, expect, it, vi } from 'vitest';
import { fakeConfig, repoEvent } from '../../test/fakes.js';
import { PermanentActionError, SlackApiError } from './errors.js';
import { escapeSlack, SlackNotifier } from './slack-notifier.js';

const URL = 'https://hooks.slack.com/services/T0/B0/xyz';

function setup(status = 200, url: string | null = URL) {
  const fetch = vi.fn().mockResolvedValue(new Response('ok', { status }));
  vi.stubGlobal('fetch', fetch);
  const notifier = new SlackNotifier(fakeConfig({ SLACK_WEBHOOK_URL: url ?? undefined }));
  const sent = () => JSON.parse(fetch.mock.calls[0][1].body);
  return { fetch, notifier, sent };
}

describe('escapeSlack', () => {
  it('escapes Slack control characters so payload text cannot ping', () => {
    expect(escapeSlack('<!channel> & <@U1>')).toBe('&lt;!channel&gt; &amp; &lt;@U1&gt;');
  });
});

describe('SlackNotifier', () => {
  it('posts a Block Kit message to the webhook', async () => {
    const { fetch, notifier, sent } = setup();
    await notifier.notify(repoEvent(), 'Bugs');
    expect(fetch.mock.calls[0][0]).toBe(URL);
    const body = sent();
    expect(body.text).toBe('octo/repo: #7 bug: crash on save');
    expect(body.blocks[0].text.text).toBe('*<https://github.com/octo/repo/issues/7|#7 bug: crash on save>*');
    expect(body.blocks[1].elements[0].text).toBe('*octo/repo* · `issues.opened` · by alice · rule: Bugs');
  });

  it('escapes user-controlled text', async () => {
    const { notifier, sent } = setup();
    await notifier.notify(repoEvent({ title: '<!here> urgent', actor: 'a&b' }), '<rule>');
    const text = JSON.stringify(sent());
    expect(text).not.toContain('<!here>');
    expect(text).toContain('&lt;!here&gt;');
    expect(text).toContain('rule: &lt;rule&gt;');
  });

  it('formats a push without number, action or link', async () => {
    const { notifier, sent } = setup();
    await notifier.notify(repoEvent({ event: 'push', action: null, number: null, title: '', url: null }), 'r');
    const body = sent();
    expect(body.blocks[0].text.text).toBe('*(no title)*');
    expect(body.blocks[1].elements[0].text).toContain('`push`');
  });

  it('fails permanently when no webhook URL is configured', async () => {
    const { fetch, notifier } = setup(200, null);
    await expect(notifier.notify(repoEvent(), 'r')).rejects.toBeInstanceOf(PermanentActionError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws SlackApiError with the status on a non-2xx reply', async () => {
    const { notifier } = setup(500);
    await expect(notifier.notify(repoEvent(), 'r')).rejects.toEqual(new SlackApiError(500));
  });
});
