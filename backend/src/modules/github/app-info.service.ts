import { Injectable, Logger } from '@nestjs/common';
import { UpstreamUnavailableError } from '../../core/errors/domain.error.js';
import { errorMessage } from '../../core/errors/error-message.js';
import { GithubService } from './github.service.js';
import type { GithubApp } from './github.types.js';

// App settings change rarely; the Repositories page should not hit GitHub on every load.
const CACHE_TTL_MS = 10 * 60_000;

@Injectable()
export class AppInfoService {
  private readonly logger = new Logger(AppInfoService.name);
  private cache?: { value: GithubApp; at: number };

  constructor(private readonly github: GithubService) {}

  async get(): Promise<GithubApp> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS)
      return this.cache.value;
    try {
      const value = await this.github.getApp();
      this.cache = { value, at: Date.now() };
      return value;
    } catch (err) {
      this.logger.warn(`App info fetch failed: ${errorMessage(err)}`);
      throw new UpstreamUnavailableError('GitHub call failed');
    }
  }
}
