import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { fakeConfig, httpContext } from '../../fakes.js';
import { WebhookSignatureGuard } from '../../../modules/webhooks/webhook-signature.guard.js';

const SECRET = 's'.repeat(40);
const BODY = Buffer.from('{"action":"opened","zen":"Keep it simple."}');
const sign = (body: Buffer, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const guard = new WebhookSignatureGuard(fakeConfig({ GITHUB_WEBHOOK_SECRET: SECRET }));
// null stands for "no raw body"; undefined would fall back to the default.
const check = (headers: Record<string, unknown>, rawBody: Buffer | null = BODY) =>
  () => guard.canActivate(httpContext({ headers, rawBody: rawBody ?? undefined }));

describe('WebhookSignatureGuard', () => {
  it('accepts a correct signature over the raw bytes', () => {
    expect(check({ 'x-hub-signature-256': sign(BODY) })()).toBe(true);
  });

  it.each([
    ['a missing header', {}, BODY],
    ['a missing raw body', { 'x-hub-signature-256': sign(BODY) }, null],
    ['a signature from another secret', { 'x-hub-signature-256': sign(BODY, 'x'.repeat(40)) }, BODY],
    ['a tampered body', { 'x-hub-signature-256': sign(BODY) }, Buffer.from(`${BODY} `)],
    ['a truncated signature', { 'x-hub-signature-256': sign(BODY).slice(0, -2) }, BODY],
    ['the legacy sha1 header only', { 'x-hub-signature': 'sha1=abc' }, BODY],
    ['a header array', { 'x-hub-signature-256': [sign(BODY)] }, BODY],
  ])('rejects %s with a bare 401', (_name, headers, body) => {
    expect(check(headers, body)).toThrow(UnauthorizedException);
  });

  it('signs bytes, not re-serialised JSON: whitespace changes break the signature', () => {
    const reformatted = Buffer.from(JSON.stringify(JSON.parse(BODY.toString()), null, 2));
    expect(check({ 'x-hub-signature-256': sign(BODY) }, reformatted)).toThrow(UnauthorizedException);
  });
});
