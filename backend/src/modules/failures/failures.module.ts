import { Module } from '@nestjs/common';
import { FailuresController } from './failures.controller.js';
import { FailuresRepository } from './failures.repository.js';
import { FailuresService } from './failures.service.js';

@Module({
  controllers: [FailuresController],
  providers: [FailuresRepository, FailuresService],
})
export class FailuresModule {}
