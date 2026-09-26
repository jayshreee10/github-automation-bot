import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { EventsController } from './events.controller.js';
import { EventsRepository } from './events.repository.js';
import { EventsService } from './events.service.js';
import { RepoEventHandler } from './repo-event.handler.js';

@Module({
  imports: [QueueModule, GithubModule],
  controllers: [EventsController],
  providers: [RepoEventHandler, EventsRepository, EventsService],
})
export class EventsModule {}
