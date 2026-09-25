import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { GithubApiError } from '../github/github-client.js';
import { GithubService } from '../github/github.service.js';
import { InstallationTokenService } from '../github/installation-token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubIdentityService } from '../users/github-identity.service.js';
import type { RepositoryList } from './installations.types.js';

@Injectable()
export class InstallationsService {
  private readonly logger = new Logger(InstallationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly tokens: InstallationTokenService,
    private readonly identity: GithubIdentityService,
  ) {}

  // installationId comes from the browser, so it is only a lookup key. GitHub decides who owns it.
  async connect(
    user: AuthUser,
    installationId: number,
  ): Promise<RepositoryList> {
    // Independent lookups (our DB, GitHub), so run them together.
    const [githubUserId, installation] = await Promise.all([
      this.identity.githubUserId(user.id),
      this.call(installationId, () =>
        this.github.getInstallation(installationId),
      ),
    ]);

    if (
      !githubUserId ||
      installation.account.type !== 'User' ||
      installation.account.id !== githubUserId
    ) {
      this.logger.warn(
        `Rejected installation ${installationId} for user ${user.id}: account ${installation.account.login} (${installation.account.type}) is not theirs`,
      );
      throw new ForbiddenException();
    }

    const repos = await this.call(installationId, () =>
      this.github.listInstallationRepos(installationId),
    );
    const id = BigInt(installationId);
    const ids = repos.map((r) => BigInt(r.id));
    const names = repos.map((r) => r.full_name);
    const privates = repos.map((r) => r.private);

    // Three statements regardless of repo count: a per-repo upsert loop blew Prisma's 5 s transaction limit at 55 repos.
    await this.prisma.$transaction([
      this.prisma.installation.upsert({
        where: { id },
        create: {
          id,
          userId: user.id,
          githubAccountId: BigInt(installation.account.id),
          githubAccountLogin: installation.account.login,
        },
        update: {
          userId: user.id,
          githubAccountLogin: installation.account.login,
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

    this.logger.log(
      `Installation ${installationId} synced for user ${user.id}: ${repos.length} repos`,
    );
    return this.list(user);
  }

  // Re-sync an installation the user already owns. If GitHub no longer has it, drop it locally.
  async sync(user: AuthUser, installationId: number): Promise<RepositoryList> {
    const owned = await this.prisma.installation.findFirst({
      where: { id: BigInt(installationId), userId: user.id },
      select: { id: true },
    });
    if (!owned) throw new ForbiddenException();

    try {
      return await this.connect(user, installationId);
    } catch (err) {
      if (
        !(err instanceof ForbiddenException) ||
        !(await this.isGone(installationId))
      )
        throw err;
      await this.prisma.installation.delete({ where: { id: owned.id } });
      this.tokens.forget(installationId);
      this.logger.log(
        `Installation ${installationId} no longer exists on GitHub; removed`,
      );
      return this.list(user);
    }
  }

  // Webhook-triggered re-sync, acting as the stored owner. Unknown installations are ignored, never created.
  async syncKnown(installationId: number): Promise<boolean> {
    const owner = await this.prisma.installation.findUnique({
      where: { id: BigInt(installationId) },
      select: { userId: true },
    });
    if (!owner) return false;
    await this.sync(
      { id: owner.userId, email: null, name: null },
      installationId,
    );
    return true;
  }

  // Webhook-triggered removal (App uninstalled). Repos cascade; unknown ids are a no-op.
  async removeKnown(installationId: number): Promise<boolean> {
    const { count } = await this.prisma.installation.deleteMany({
      where: { id: BigInt(installationId) },
    });
    this.tokens.forget(installationId);
    return count > 0;
  }

  // Installations are returned separately so one with zero repos still shows Sync / Manage in the UI.
  async list(user: AuthUser): Promise<RepositoryList> {
    const installations = await this.prisma.installation.findMany({
      where: { userId: user.id },
      include: { repositories: { orderBy: { fullName: 'asc' } } },
      orderBy: { githubAccountLogin: 'asc' },
    });
    return {
      installations: installations.map((i) => ({
        id: i.id.toString(),
        accountLogin: i.githubAccountLogin,
      })),
      repositories: installations.flatMap((i) =>
        i.repositories.map((r) => ({
          id: r.id.toString(),
          fullName: r.fullName,
          isPrivate: r.isPrivate,
          installationId: i.id.toString(),
          accountLogin: i.githubAccountLogin,
        })),
      ),
    };
  }

  private async isGone(installationId: number): Promise<boolean> {
    try {
      await this.github.getInstallation(installationId);
      return false;
    } catch (err) {
      return err instanceof GithubApiError && err.status === 404;
    }
  }

  // Maps GitHub failures: 404 (unknown or not ours) → 403 without detail; anything else → 502.
  private async call<T>(
    installationId: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof GithubApiError && err.status === 404) {
        this.logger.warn(`Installation ${installationId} not found on GitHub`);
        throw new ForbiddenException();
      }
      this.logger.error(
        `GitHub call failed for installation ${installationId}: ${(err as Error).message}`,
      );
      throw new BadGatewayException();
    }
  }
}
