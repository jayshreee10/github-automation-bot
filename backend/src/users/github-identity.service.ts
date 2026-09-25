import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Reads the GitHub user id Neon Auth stored at sign-in. neon_auth is Neon-managed: read-only here.
@Injectable()
export class GithubIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async githubUserId(neonUserId: string): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ accountId: string }[]>`
      SELECT "accountId" FROM neon_auth.account
      WHERE "userId"::text = ${neonUserId} AND "providerId" = 'github'
      LIMIT 1`;
    const id = Number(rows[0]?.accountId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
}
