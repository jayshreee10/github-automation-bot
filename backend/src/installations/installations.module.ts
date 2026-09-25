import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { UsersModule } from '../users/users.module.js';
import { InstallationsController } from './installations.controller.js';
import { InstallationsService } from './installations.service.js';

@Module({
  imports: [GithubModule, UsersModule],
  controllers: [InstallationsController],
  providers: [InstallationsService],
})
export class InstallationsModule {}
