import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { RepoEventHandler } from './repo-event.handler.js';

@Module({
  imports: [QueueModule, GithubModule],
  controllers: [EventsController],
  providers: [RepoEventHandler, EventsService],
})
export class EventsModule {}
