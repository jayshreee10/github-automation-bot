import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../core/database/prisma.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { InstallationsRepository } from '../../../modules/installations/installations.repository.js';

describe('InstallationsRepository.listForUser', () => {
  it('lists repos in one query scoped to the caller, keeping installations with no repos', async () => {
    const $queryRaw = vi.fn().mockResolvedValue([]);
    await new InstallationsRepository({ $queryRaw } as unknown as PrismaService).listForUser('user-1');
    expect($queryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = $queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = Prisma.sql(strings, ...values);
    expect(sql.text).toContain('WHERE i.user_id = $1');
    expect(sql.text).toContain('LEFT JOIN repositories');
    expect(sql.values).toEqual(['user-1']);
  });
});
