import { Injectable } from '@nestjs/common';
import { GithubApiError, githubFetch } from './github-client.js';
import { GithubAppService } from './github-app.service.js';
import { installationTokenSchema } from './github.types.js';

// Tokens live 1 h; refresh 5 min early so an in-flight call never uses an expired one.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

@Injectable()
export class InstallationTokenService {
  private readonly cache = new Map<
    number,
    { token: string; expiresAt: number }
  >();

  constructor(private readonly app: GithubAppService) {}

  async tokenFor(installationId: number): Promise<string> {
    const hit = this.cache.get(installationId);
    if (hit && hit.expiresAt - REFRESH_MARGIN_MS > Date.now()) return hit.token;

    const { token, expires_at } = await githubFetch(
      `/app/installations/${installationId}/access_tokens`,
      await this.app.appJwt(),
      installationTokenSchema,
      { method: 'POST' },
    );
    this.cache.set(installationId, {
      token,
      expiresAt: Date.parse(expires_at),
    });
    return token;
  }

  // Runs a call with the installation token; on 401 the cached token is dropped and the call retried once.
  async withToken<T>(
    installationId: number,
    call: (token: string) => Promise<T>,
  ): Promise<T> {
    try {
      return await call(await this.tokenFor(installationId));
    } catch (err) {
      if (!(err instanceof GithubApiError) || err.status !== 401) throw err;
      this.forget(installationId);
      return call(await this.tokenFor(installationId));
    }
  }

  // Drop a cached token, e.g. after the installation is removed.
  forget(installationId: number): void {
    this.cache.delete(installationId);
  }
}
