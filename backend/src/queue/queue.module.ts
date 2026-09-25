import { Module } from '@nestjs/common';
import { HandlerRegistry } from './handler.registry.js';
import { JobRepository } from './job-repository.js';
import { WorkerService } from './worker.service.js';

@Module({
  providers: [HandlerRegistry, JobRepository, WorkerService],
  exports: [HandlerRegistry],
})
export class QueueModule {}
