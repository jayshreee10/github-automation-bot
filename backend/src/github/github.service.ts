import { Injectable } from '@nestjs/common';
import { githubFetch } from './github-client.js';
import { GithubAppService } from './github-app.service.js';
import {
  type GithubInstallation,
  type GithubRepository,
  githubInstallationSchema,
  installationReposPageSchema,
} from './github.types.js';
import { InstallationTokenService } from './installation-token.service.js';

const PER_PAGE = 100;

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
}
