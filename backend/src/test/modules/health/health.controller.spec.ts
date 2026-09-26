import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../core/database/prisma.service.js';
import { HealthController } from '../../../modules/health/health.controller.js';

const controller = (queryRaw: () => Promise<unknown>) =>
  new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    await expect(controller(vi.fn().mockResolvedValue([1])).check()).resolves.toEqual({
      status: 'ok',
      db: 'ok',
    });
  });

  it('returns 503 when the database is unreachable', async () => {
    const down = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(controller(down).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
