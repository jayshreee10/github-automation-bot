import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../core/database/prisma.service.js';
import { GithubIdentityService } from '../../../modules/users/github-identity.service.js';

const setup = (rows: unknown[]) => {
  const $queryRaw = vi.fn().mockResolvedValue(rows);
  return { $queryRaw, identity: new GithubIdentityService({ $queryRaw } as unknown as PrismaService) };
};
const service = (rows: unknown[]) => setup(rows).identity;

describe('GithubIdentityService.githubUserId', () => {
  it('returns the GitHub account id Neon Auth stored', async () => {
    await expect(service([{ accountId: '583231' }]).githubUserId('u1')).resolves.toBe(583231);
  });

  it.each([
    ['no GitHub account', []],
    ['a non-numeric id', [{ accountId: 'abc' }]],
    ['a zero id', [{ accountId: '0' }]],
    ['an unsafe integer', [{ accountId: '99999999999999999999' }]],
  ])('returns null for %s', async (_name, rows) => {
    await expect(service(rows).githubUserId('u1')).resolves.toBeNull();
  });
});

describe('GithubIdentityService.githubLogin', () => {
  it('returns the login of the caller’s own installation, scoped by user id', async () => {
    const { identity, $queryRaw } = setup([{ login: 'octocat' }]);
    await expect(identity.githubLogin('u1')).resolves.toBe('octocat');
    const [strings, ...values] = $queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(Prisma.sql(strings, ...values).values).toEqual(['u1']);
  });

  it('returns null before the App is installed', async () => {
    await expect(service([]).githubLogin('u1')).resolves.toBeNull();
  });
});
