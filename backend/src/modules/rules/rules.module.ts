import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { RulesEventHandler } from './rules-event.handler.js';
import { RulesController } from './rules.controller.js';
import { RulesRepository } from './rules.repository.js';
import { RulesService } from './rules.service.js';

@Module({
  imports: [QueueModule, ActionsModule],
  controllers: [RulesController],
  providers: [RulesRepository, RulesService, RulesEventHandler],
})
export class RulesModule {}
