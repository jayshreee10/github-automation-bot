import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { EventsController } from './events.controller.js';
import { EventsRepository } from './events.repository.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [GithubModule],
  controllers: [EventsController],
  providers: [EventsRepository, EventsService],
})
export class EventsModule {}
