import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import type {
  GithubInstallation,
  GithubRepository,
} from '../github/github.types.js';

// All SQL for installations and their repositories. Services stay free of Prisma calls.
@Injectable()
export class InstallationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isOwnedBy(installationId: number, userId: string): Promise<boolean> {
    const row = await this.prisma.installation.findFirst({
      where: { id: BigInt(installationId), userId },
      select: { id: true },
    });
    return row !== null;
  }

  async findOwnerId(installationId: number): Promise<string | null> {
    const row = await this.prisma.installation.findUnique({
      where: { id: BigInt(installationId) },
      select: { userId: true },
    });
    return row?.userId ?? null;
  }

  // Three statements regardless of repo count: a per-repo upsert loop blew Prisma's 5 s transaction limit at 55 repos.
  async saveWithRepos(
    installationId: number,
    userId: string,
    account: GithubInstallation['account'],
    repos: GithubRepository[],
  ): Promise<void> {
    const id = BigInt(installationId);
    const ids = repos.map((r) => BigInt(r.id));
    const names = repos.map((r) => r.full_name);
    const privates = repos.map((r) => r.private);

    await this.prisma.$transaction([
      this.prisma.installation.upsert({
        where: { id },
        create: {
          id,
          userId,
          githubAccountId: BigInt(account.id),
          githubAccountLogin: account.login,
        },
        update: {
          userId,
          githubAccountLogin: account.login,
        },
      }),
      this.prisma.$executeRaw`
        INSERT INTO repositories (id, installation_id, full_name, is_private)
        SELECT r.id, ${id}, r.full_name, r.is_private
        FROM unnest(${ids}::bigint[], ${names}::text[], ${privates}::boolean[])
          AS r(id, full_name, is_private)
        ON CONFLICT (id) DO UPDATE SET
          installation_id = EXCLUDED.installation_id,
          full_name = EXCLUDED.full_name,
          is_private = EXCLUDED.is_private`,
      this.prisma.repository.deleteMany({
        where: { installationId: id, id: { notIn: ids } },
      }),
    ]);
  }

  async delete(installationId: number): Promise<void> {
    await this.prisma.installation.delete({
      where: { id: BigInt(installationId) },
    });
  }

  // Repos cascade. Returns false when the id was unknown.
  async deleteIfExists(installationId: number): Promise<boolean> {
    const { count } = await this.prisma.installation.deleteMany({
      where: { id: BigInt(installationId) },
    });
    return count > 0;
  }

  listForUser(userId: string) {
    return this.prisma.installation.findMany({
      where: { userId },
      include: { repositories: { orderBy: { fullName: 'asc' } } },
      orderBy: { githubAccountLogin: 'asc' },
    });
  }
}
