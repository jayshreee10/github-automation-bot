import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../core/database/prisma.service.js';
import { GithubIdentityService } from './github-identity.service.js';

const service = (rows: unknown[]) =>
  new GithubIdentityService({
    $queryRaw: vi.fn().mockResolvedValue(rows),
  } as unknown as PrismaService);

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
