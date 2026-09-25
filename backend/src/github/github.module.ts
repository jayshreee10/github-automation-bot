import { Module } from '@nestjs/common';
import { GithubAppService } from './github-app.service.js';
import { GithubService } from './github.service.js';
import { InstallationTokenService } from './installation-token.service.js';

@Module({
  providers: [GithubAppService, InstallationTokenService, GithubService],
  exports: [GithubService, InstallationTokenService],
})
export class GithubModule {}
