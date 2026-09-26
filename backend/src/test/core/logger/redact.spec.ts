import { describe, expect, it } from 'vitest';
import { redact, redactExact } from '../../../core/logger/redact.js';

const MASK = '[REDACTED]';

describe('redact', () => {
  it('masks values under sensitive keys, at any depth', () => {
    const out = redact({
      token: 'abc',
      nested: { Authorization: 'Bearer x', apiKey: 'k', private_key: 'p' },
      DATABASE_URL: 'postgres://u:p@h/db',
      safe: 'visible',
    });
    expect(out).toEqual({
      token: MASK,
      nested: { Authorization: MASK, apiKey: MASK, private_key: MASK },
      DATABASE_URL: MASK,
      safe: 'visible',
    });
  });

  it.each([
    ['GitHub token', `token ghs_${'a'.repeat(36)} used`],
    ['GitHub PAT', `github_pat_${'b'.repeat(40)}`],
    ['Slack bot token', 'xoxb-123-456-abc'],
    ['Slack webhook URL', 'https://hooks.slack.com/services/T0/B0/xyz'],
    ['Bearer header', 'Authorization: Bearer eyJhbGciOi.payload.sig'],
    [
      'PEM key',
      '-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----',
    ],
  ])('masks a %s inside free text', (_name, text) => {
    const out = redact(text) as string;
    expect(out).toContain(MASK);
    expect(out).not.toMatch(/ghs_a|github_pat_b|xoxb-|T0\/B0|eyJhbGciOi|MIIE/);
  });

  it('masks URL passwords but keeps user and host', () => {
    expect(redact('connect postgres://app:s3cret@db.neon.tech/main')).toBe(
      `connect postgres://app:${MASK}@db.neon.tech/main`,
    );
  });

  it('masks registered exact secrets; ignores ones too short to be safe', () => {
    redactExact('rand0m-webhook-secret-value');
    redactExact('short');
    expect(redact('sig rand0m-webhook-secret-value end')).toBe(
      `sig ${MASK} end`,
    );
    expect(redact('a short word')).toBe('a short word');
  });

  it('returns a redacted copy of an Error, keeping its name', () => {
    const err = new TypeError('failed with Bearer abc.def');
    const out = redact(err) as Error;
    expect(out).not.toBe(err);
    expect(out.name).toBe('TypeError');
    expect(out.message).toBe(`failed with ${MASK}`);
    expect(err.message).toBe('failed with Bearer abc.def');
  });

  it('handles arrays, primitives and circular references without mutating input', () => {
    const input: Record<string, unknown> = { list: ['Bearer t', 1, null] };
    input.self = input;
    const out = redact(input) as Record<string, unknown>;
    expect(out.list).toEqual([MASK, 1, null]);
    expect(out.self).toBe('[Circular]');
    expect(input.list).toEqual(['Bearer t', 1, null]);
    expect(redact(5)).toBe(5);
    expect(redact(undefined)).toBeUndefined();
  });
});
