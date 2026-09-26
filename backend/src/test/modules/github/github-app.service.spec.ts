import { generateKeyPairSync } from 'node:crypto';
import { decodeJwt, decodeProtectedHeader, jwtVerify } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeConfig } from '../../fakes.js';
import { GithubAppService } from '../../../modules/github/github-app.service.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const service = () =>
  new GithubAppService(
    fakeConfig({ GITHUB_APP_ID: 999, GITHUB_APP_PRIVATE_KEY: privateKey }),
  );

describe('GithubAppService.appJwt', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('signs an RS256 JWT issued by the App id, within GitHub’s 10 min cap', async () => {
    const jwt = await service().appJwt();
    const { payload } = await jwtVerify(jwt, publicKey, { issuer: '999' });
    expect(decodeProtectedHeader(jwt).alg).toBe('RS256');
    const now = Math.floor(Date.now() / 1000);
    expect(payload.iat).toBeLessThanOrEqual(now - 59);
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(600);
  });

  it('reuses the cached JWT until a minute before expiry, then signs a new one', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const svc = service();
    const first = await svc.appJwt();

    vi.advanceTimersByTime(7 * 60_000);
    expect(await svc.appJwt()).toBe(first);

    vi.advanceTimersByTime(60_000);
    const second = await svc.appJwt();
    expect(second).not.toBe(first);
    expect(decodeJwt(second).exp).toBeGreaterThan(decodeJwt(first).exp!);
  });
});
