import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fakeConfig } from '../../fakes.js';
import { SecretBox, SecretBoxError } from '../../../modules/slack/secret-box.js';

const box = () => new SecretBox(fakeConfig({ SETTINGS_ENCRYPTION_KEY: randomBytes(32) }));

describe('SecretBox', () => {
  it('round-trips a value and never stores it in clear', () => {
    const b = box();
    const sealed = b.seal('https://hooks.slack.com/services/T/B/secret', 'user-1');
    expect(sealed).not.toContain('secret');
    expect(b.open(sealed, 'user-1')).toBe('https://hooks.slack.com/services/T/B/secret');
  });

  it('uses a fresh IV each time', () => {
    const b = box();
    expect(b.seal('x', 'u')).not.toBe(b.seal('x', 'u'));
  });

  it('refuses a value sealed for another context', () => {
    const b = box();
    expect(() => b.open(b.seal('x', 'user-1'), 'user-2')).toThrow(SecretBoxError);
  });

  it('refuses a value sealed with another key', () => {
    expect(() => box().open(box().seal('x', 'u'), 'u')).toThrow(SecretBoxError);
  });

  it('refuses a malformed stored value', () => {
    expect(() => box().open('plain-text', 'u')).toThrow(SecretBoxError);
  });
});
