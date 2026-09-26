import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Never read the developer's real backend/.env.
vi.mock('node:fs', () => ({ existsSync: () => false }));

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM_B64 = Buffer.from(
  privateKey.export({ type: 'pkcs1', format: 'pem' }),
).toString('base64');

const VALID: Record<string, string> = {
  DATABASE_URL: 'postgresql://app:pw@db.example.com/main',
  NEON_AUTH_URL: 'https://auth.example.com/neondb/auth',
  GITHUB_APP_ID: '12345',
  GITHUB_APP_SLUG: 'my-bot',
  GITHUB_APP_PRIVATE_KEY: PEM_B64,
  GITHUB_WEBHOOK_SECRET: 'w'.repeat(40),
};

function stubEnv(values: Record<string, string | undefined>) {
  for (const key of ['NODE_ENV', 'PORT', 'SLACK_WEBHOOK_URL', 'SMEE_URL'])
    vi.stubEnv(key, undefined);
  for (const [key, value] of Object.entries({ ...VALID, ...values }))
    vi.stubEnv(key, value);
}

// Fresh module each time: loadEnv caches its first result.
async function load() {
  const mod = await import('./env.js');
  return mod.loadEnv();
}

describe('loadEnv', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('parses a valid env and applies defaults', async () => {
    stubEnv({});
    const env = await load();
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.GITHUB_APP_ID).toBe(12345);
    expect(env.GITHUB_APP_PRIVATE_KEY.type).toBe('private');
    expect(env.SLACK_WEBHOOK_URL).toBeUndefined();
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('caches the parsed env', async () => {
    stubEnv({});
    const mod = await import('./env.js');
    expect(mod.loadEnv()).toBe(mod.loadEnv());
  });

  it('treats an empty SLACK_WEBHOOK_URL as unset', async () => {
    stubEnv({ SLACK_WEBHOOK_URL: '' });
    expect((await load()).SLACK_WEBHOOK_URL).toBeUndefined();
  });

  it('registers the webhook secret for log redaction', async () => {
    stubEnv({});
    await load();
    const { redact } = await import('../logger/redact.js');
    expect(redact(`x ${VALID.GITHUB_WEBHOOK_SECRET} y`)).toBe('x [REDACTED] y');
  });

  it.each([
    ['DATABASE_URL', 'mysql://u:p@h/db'],
    ['NEON_AUTH_URL', 'http://auth.example.com'],
    ['GITHUB_APP_SLUG', 'Bad Slug'],
    ['GITHUB_APP_PRIVATE_KEY', Buffer.from('not a key').toString('base64')],
    ['GITHUB_WEBHOOK_SECRET', 'too-short'],
    ['SLACK_WEBHOOK_URL', 'https://evil.example.com/services/x'],
    ['GITHUB_APP_ID', undefined],
  ])('exits listing only the name when %s is invalid', async (name, value) => {
    stubEnv({ [name]: value });
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(load()).rejects.toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
    const printed = String(error.mock.calls[0][0]);
    expect(printed).toContain(name);
    if (value) expect(printed).not.toContain(value);
  });
});
