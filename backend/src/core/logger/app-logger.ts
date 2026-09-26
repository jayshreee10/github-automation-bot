import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { requestContext } from '../context/request-context.js';
import { redact } from './redact.js';

interface JsonLogOptions {
  context: string;
  logLevel: LogLevel;
  writeStreamType?: 'stdout' | 'stderr';
  errorStack?: unknown;
  params?: Record<string, any>;
}

// JSON logs in production, readable logs in development. Every message passes through redact() first.
// Correlation ids from the request context are added as JSON fields, or as a prefix in development.
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

  protected override getJsonLogObject(
    message: unknown,
    options: JsonLogOptions,
  ) {
    return { ...super.getJsonLogObject(message, options), ...contextIds() };
  }

  protected override formatContext(context: string): string {
    const tag = Object.entries(contextIds())
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    return super.formatContext(context) + (tag ? `(${tag}) ` : '');
  }
}

// Only set ids, in a fixed order, so dev prefixes read the same on every line.
function contextIds(): Record<string, string> {
  const ctx = requestContext.get();
  if (!ctx) return {};
  const ids: Record<string, string> = {};
  for (const key of ['requestId', 'deliveryId', 'jobId', 'userId'] as const)
    if (ctx[key]) ids[key] = ctx[key];
  return ids;
}
