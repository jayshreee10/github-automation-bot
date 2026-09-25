import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { UsersModule } from '../users/users.module.js';
import { InstallationEventsHandler } from './installation-events.handler.js';
import { InstallationsController } from './installations.controller.js';
import { InstallationsService } from './installations.service.js';

@Module({
  imports: [GithubModule, UsersModule, QueueModule],
  controllers: [InstallationsController],
  providers: [InstallationsService, InstallationEventsHandler],
})
export class InstallationsModule {}
