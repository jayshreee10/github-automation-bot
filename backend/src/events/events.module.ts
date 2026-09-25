import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module.js';
import { RepoEventHandler } from './repo-event.handler.js';

@Module({
  imports: [QueueModule],
  providers: [RepoEventHandler],
})
export class EventsModule {}
