import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service.js';
import type {
  GithubInstallation,
  GithubRepository,
} from '../github/github.types.js';

export interface InstallationRepoRow {
  installationId: bigint;
  accountLogin: string;
  accountType: string | null;
  repositorySelection: string | null;
  repoId: bigint | null;
  fullName: string | null;
  isPrivate: boolean | null;
  defaultBranch: string | null;
  ruleCount: number;
  lastEventAt: Date | null;
}

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
    installation: GithubInstallation,
    repos: GithubRepository[],
  ): Promise<void> {
    const id = BigInt(installationId);
    const { account } = installation;
    const details = {
      githubAccountLogin: account.login,
      accountType: account.type,
      repositorySelection: installation.repository_selection ?? null,
    };
    const ids = repos.map((r) => BigInt(r.id));
    const names = repos.map((r) => r.full_name);
    const privates = repos.map((r) => r.private);
    const branches = repos.map((r) => r.default_branch ?? null);

    await this.prisma.$transaction([
      this.prisma.installation.upsert({
        where: { id },
        create: {
          id,
          userId,
          githubAccountId: BigInt(account.id),
          ...details,
        },
        update: { userId, ...details },
      }),
      this.prisma.$executeRaw`
        INSERT INTO repositories (id, installation_id, full_name, is_private, default_branch)
        SELECT r.id, ${id}, r.full_name, r.is_private, r.default_branch
        FROM unnest(${ids}::bigint[], ${names}::text[], ${privates}::boolean[], ${branches}::text[])
          AS r(id, full_name, is_private, default_branch)
        ON CONFLICT (id) DO UPDATE SET
          installation_id = EXCLUDED.installation_id,
          full_name = EXCLUDED.full_name,
          is_private = EXCLUDED.is_private,
          default_branch = EXCLUDED.default_branch`,
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

  // One round trip: installations left-joined to repos, with rule count and newest delivery per repo.
  // An installation with no repos comes back once with repoId null.
  listForUser(userId: string): Promise<InstallationRepoRow[]> {
    return this.prisma.$queryRaw<InstallationRepoRow[]>`
      SELECT i.id AS "installationId", i.github_account_login AS "accountLogin",
        i.account_type AS "accountType", i.repository_selection AS "repositorySelection",
        r.id AS "repoId", r.full_name AS "fullName", r.is_private AS "isPrivate",
        r.default_branch AS "defaultBranch",
        (SELECT count(*)::int FROM rules x WHERE x.repository_id = r.id) AS "ruleCount",
        (SELECT max(d.received_at) FROM webhook_deliveries d WHERE d.repository_id = r.id) AS "lastEventAt"
      FROM installations i
      LEFT JOIN repositories r ON r.installation_id = i.id
      WHERE i.user_id = ${userId}
      ORDER BY i.github_account_login, i.id, r.full_name`;
  }
}
