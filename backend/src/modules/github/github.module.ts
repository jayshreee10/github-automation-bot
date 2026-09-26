import { Module } from '@nestjs/common';
import { AppInfoController } from './app-info.controller.js';
import { AppInfoService } from './app-info.service.js';
import { GithubAppService } from './github-app.service.js';
import { GithubService } from './github.service.js';
import { InstallationTokenService } from './installation-token.service.js';

@Module({
  controllers: [AppInfoController],
  providers: [
    GithubAppService,
    InstallationTokenService,
    GithubService,
    AppInfoService,
  ],
  exports: [GithubService, InstallationTokenService],
})
export class GithubModule {}
