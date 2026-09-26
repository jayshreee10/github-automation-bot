import { Injectable } from '@nestjs/common';
import type { JobHandler } from './job-handler.js';

// Maps an event name to its handler. Feature modules register theirs on init; ingestion stores only events listed here.
@Injectable()
export class HandlerRegistry {
  private readonly handlers = new Map<string, JobHandler>();

  register(handler: JobHandler): void {
    for (const event of handler.events) {
      if (this.handlers.has(event))
        throw new Error(`Duplicate job handler for event ${event}`);
      this.handlers.set(event, handler);
    }
  }

  handles(event: string): boolean {
    return this.handlers.has(event);
  }

  get(event: string): JobHandler | undefined {
    return this.handlers.get(event);
  }
}
