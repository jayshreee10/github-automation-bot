import { Injectable, Logger } from '@nestjs/common';
import {
  AccessDeniedError,
  UpstreamUnavailableError,
} from '../../core/errors/domain.error.js';
import { errorMessage } from '../../core/errors/error-message.js';
import { GithubApiError } from '../github/github-client.js';
import { GithubService } from '../github/github.service.js';
import { InstallationTokenService } from '../github/installation-token.service.js';
import { GithubIdentityService } from '../users/github-identity.service.js';
import { InstallationsRepository } from './installations.repository.js';
import type { RepositoryList } from './installations.types.js';

@Injectable()
export class InstallationsService {
  private readonly logger = new Logger(InstallationsService.name);

  constructor(
    private readonly installations: InstallationsRepository,
    private readonly github: GithubService,
    private readonly tokens: InstallationTokenService,
    private readonly identity: GithubIdentityService,
  ) {}

  // installationId comes from the browser, so it is only a lookup key. GitHub decides who owns it.
  async connect(
    userId: string,
    installationId: number,
  ): Promise<RepositoryList> {
    // Independent lookups (our DB, GitHub), so run them together.
    const [githubUserId, installation] = await Promise.all([
      this.identity.githubUserId(userId),
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
        `Rejected installation ${installationId} for user ${userId}: account ${installation.account.login} (${installation.account.type}) is not theirs`,
      );
      throw new AccessDeniedError('installation owner mismatch');
    }

    const repos = await this.call(installationId, () =>
      this.github.listInstallationRepos(installationId),
    );
    await this.installations.saveWithRepos(
      installationId,
      userId,
      installation,
      repos,
    );

    this.logger.log(
      `Installation ${installationId} synced for user ${userId}: ${repos.length} repos`,
    );
    return this.list(userId);
  }

  // Re-sync an installation the user already owns. If GitHub no longer has it, drop it locally.
  async sync(userId: string, installationId: number): Promise<RepositoryList> {
    if (!(await this.installations.isOwnedBy(installationId, userId)))
      throw new AccessDeniedError('installation not owned');

    try {
      return await this.connect(userId, installationId);
    } catch (err) {
      if (
        !(err instanceof AccessDeniedError) ||
        !(await this.isGone(installationId))
      )
        throw err;
      await this.installations.delete(installationId);
      this.tokens.forget(installationId);
      this.logger.log(
        `Installation ${installationId} no longer exists on GitHub; removed`,
      );
      return this.list(userId);
    }
  }

  // Webhook-triggered re-sync, acting as the stored owner. Unknown installations are ignored, never created.
  async syncKnown(installationId: number): Promise<boolean> {
    const ownerId = await this.installations.findOwnerId(installationId);
    if (!ownerId) return false;
    await this.sync(ownerId, installationId);
    return true;
  }

  // Webhook-triggered removal (App uninstalled). Repos cascade; unknown ids are a no-op.
  async removeKnown(installationId: number): Promise<boolean> {
    const removed = await this.installations.deleteIfExists(installationId);
    this.tokens.forget(installationId);
    return removed;
  }

  // Installations are returned separately so one with zero repos still shows Sync / Manage in the UI.
  async list(userId: string): Promise<RepositoryList> {
    const rows = await this.installations.listForUser(userId);
    const installations = new Map<
      string,
      RepositoryList['installations'][number]
    >();
    const repositories: RepositoryList['repositories'] = [];
    for (const row of rows) {
      const installationId = row.installationId.toString();
      if (!installations.has(installationId))
        installations.set(installationId, {
          id: installationId,
          accountLogin: row.accountLogin,
          accountType: row.accountType,
          repositorySelection: row.repositorySelection,
        });
      if (row.repoId === null || row.fullName === null) continue;
      repositories.push({
        id: row.repoId.toString(),
        fullName: row.fullName,
        isPrivate: row.isPrivate ?? false,
        defaultBranch: row.defaultBranch,
        installationId,
        accountLogin: row.accountLogin,
        ruleCount: row.ruleCount,
        lastEventAt: row.lastEventAt?.toISOString() ?? null,
      });
    }
    return { installations: [...installations.values()], repositories };
  }

  private async isGone(installationId: number): Promise<boolean> {
    try {
      await this.github.getInstallation(installationId);
      return false;
    } catch (err) {
      return err instanceof GithubApiError && err.status === 404;
    }
  }

  // Maps GitHub failures: 404 (unknown or not ours) → access denied without detail; anything else → upstream failure.
  private async call<T>(
    installationId: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof GithubApiError && err.status === 404) {
        this.logger.warn(`Installation ${installationId} not found on GitHub`);
        throw new AccessDeniedError('installation not found on GitHub');
      }
      this.logger.error(
        `GitHub call failed for installation ${installationId}: ${errorMessage(err)}`,
      );
      throw new UpstreamUnavailableError('GitHub call failed');
    }
  }
}
