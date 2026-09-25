import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  githubFetch,
  githubFetchPage,
  githubRequest,
} from './github-client.js';
import { GithubAppService } from './github-app.service.js';
import {
  type GithubHookDelivery,
  type GithubInstallation,
  hookDeliverySchema,
  type GithubRepository,
  githubInstallationSchema,
  installationReposPageSchema,
} from './github.types.js';
import { InstallationTokenService } from './installation-token.service.js';

const PER_PAGE = 100;
// Bounds one catch-up scan (100 deliveries per page).
const MAX_DELIVERY_PAGES = 20;

// GitHub calls made as the App (App JWT) or as an installation (installation token).
@Injectable()
export class GithubService {
  constructor(
    private readonly app: GithubAppService,
    private readonly tokens: InstallationTokenService,
  ) {}

  async getInstallation(installationId: number): Promise<GithubInstallation> {
    return githubFetch(
      `/app/installations/${installationId}`,
      await this.app.appJwt(),
      githubInstallationSchema,
    );
  }

  // Pages until total_count is reached; an empty page also stops the loop.
  async listInstallationRepos(
    installationId: number,
  ): Promise<GithubRepository[]> {
    const repos: GithubRepository[] = [];
    for (let page = 1; ; page++) {
      const body = await githubFetch(
        `/installation/repositories?per_page=${PER_PAGE}&page=${page}`,
        await this.tokens.tokenFor(installationId),
        installationReposPageSchema,
      );
      repos.push(...body.repositories);
      if (body.repositories.length === 0 || repos.length >= body.total_count)
        return repos;
    }
  }

  // App webhook deliveries newer than `since`, newest first. Stops at the first page reaching past it.
  async listHookDeliveries(since: Date): Promise<GithubHookDelivery[]> {
    const out: GithubHookDelivery[] = [];
    let path: string | null = `/app/hook/deliveries?per_page=${PER_PAGE}`;
    for (let page = 0; path && page < MAX_DELIVERY_PAGES; page++) {
      const {
        data,
        next,
      }: { data: GithubHookDelivery[]; next: string | null } =
        await githubFetchPage(
          path,
          await this.app.appJwt(),
          z.array(hookDeliverySchema),
        );
      const recent = data.filter((d) => new Date(d.delivered_at) >= since);
      out.push(...recent);
      path = recent.length === data.length ? next : null;
    }
    return out;
  }

  // Asks GitHub to send a past delivery again, with the same guid and a fresh signature.
  async redeliver(deliveryId: string): Promise<void> {
    await githubRequest(
      `/app/hook/deliveries/${deliveryId}/attempts`,
      await this.app.appJwt(),
      { method: 'POST' },
    );
  }
}
