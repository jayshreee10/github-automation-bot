import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { redact } from './redact.js';

// JSON logs in production, readable logs in development. Every message passes through redact() first.
export class AppLogger extends ConsoleLogger {
  constructor(production: boolean) {
    super({ json: production, colors: !production });
  }

  protected override printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
    params?: Record<string, any>,
  ): void {
    super.printMessages(
      messages.map((m) => redact(m)),
      context,
      logLevel,
      writeStreamType,
      typeof errorStack === 'string' ? redact(errorStack) : errorStack,
      params && (redact(params) as Record<string, any>),
    );
  }
}
