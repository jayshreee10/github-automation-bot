import { UnauthorizedException } from '@nestjs/common';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  SignJWT,
} from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeConfig } from '../../fakes.js';
import { AuthService } from '../../../modules/auth/auth.service.js';

// The remote JWKS is swapped for a local one holding the test key.
const jwks = vi.hoisted(() => ({
  current: undefined as ReturnType<typeof createLocalJWKSet> | undefined,
  url: undefined as URL | undefined,
}));
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return {
    ...actual,
    createRemoteJWKSet: (url: URL) => {
      jwks.url = url;
      return (...args: Parameters<ReturnType<typeof createLocalJWKSet>>) =>
        jwks.current!(...args);
    },
  };
});

const AUTH_URL = 'https://ep-test.neonauth.example.com/neondb/auth/';
const ISSUER = 'https://ep-test.neonauth.example.com';

let signingKey: CryptoKey;
let strangerKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA');
  signingKey = pair.privateKey;
  strangerKey = (await generateKeyPair('EdDSA')).privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks.current = createLocalJWKSet({
    keys: [{ ...jwk, kid: 'k1', alg: 'EdDSA' }],
  });
});

function token(
  claims: JWTPayload = { sub: 'user-1', email: 'a@b.c', name: 'Alice' },
  opts: { key?: CryptoKey; issuer?: string; exp?: string | number } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
    .setIssuer(opts.issuer ?? ISSUER)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '15m')
    .sign(opts.key ?? signingKey);
}

const service = () =>
  new AuthService(fakeConfig({ NEON_AUTH_URL: AUTH_URL }));

describe('AuthService.verify', () => {
  it('fetches keys from the Neon Auth JWKS endpoint', () => {
    service();
    expect(jwks.url?.href).toBe(`${AUTH_URL}.well-known/jwks.json`);
  });

  it('returns the user for a valid token', async () => {
    await expect(service().verify(await token())).resolves.toEqual({
      id: 'user-1',
      email: 'a@b.c',
      name: 'Alice',
      image: null,
    });
  });

  it('turns non-string email and name into null', async () => {
    const t = await token({ sub: 'u', email: 5, name: ['x'] });
    await expect(service().verify(t)).resolves.toEqual({
      id: 'u',
      email: null,
      name: null,
      image: null,
    });
  });

  it('keeps an https avatar and drops any other scheme', async () => {
    const avatar = 'https://avatars.githubusercontent.com/u/1?v=4';
    const ok = await token({ sub: 'u', image: avatar });
    await expect(service().verify(ok)).resolves.toMatchObject({ image: avatar });
    const bad = await token({ sub: 'u', image: 'javascript:alert(1)' });
    await expect(service().verify(bad)).resolves.toMatchObject({ image: null });
  });

  it.each([
    ['a wrong issuer', () => token(undefined, { issuer: 'https://evil.example.com' })],
    ['an expired token', () => token(undefined, { exp: Math.floor(Date.now() / 1000) - 60 })],
    ['a missing sub', () => token({ email: 'a@b.c' })],
    ['an unknown signing key', () => token(undefined, { key: strangerKey })],
    [
      'an HS256 token',
      () =>
        new SignJWT({ sub: 'u' })
          .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
          .setIssuer(ISSUER)
          .setExpirationTime('15m')
          .sign(new TextEncoder().encode('x'.repeat(32))),
    ],
    ['garbage', async () => 'not.a.jwt'],
  ])('rejects %s with a bare 401', async (_name, make) => {
    await expect(service().verify(await make())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
