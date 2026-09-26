import { stripVTControlCharacters } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestContext } from '../../../core/context/request-context.js';
import { AppLogger } from '../../../core/logger/app-logger.js';

function captureStdout() {
  const lines: string[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    lines.push(String(chunk));
    return true;
  });
  return lines;
}

describe('AppLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds context ids as JSON fields in production', () => {
    const lines = captureStdout();
    requestContext.run({ deliveryId: 'd-1', jobId: 'j-1' }, () => new AppLogger(true).log('done', 'Worker'));
    expect(JSON.parse(lines[0])).toMatchObject({ message: 'done', context: 'Worker', deliveryId: 'd-1', jobId: 'j-1' });
  });

  it('prefixes context ids in development', () => {
    const lines = captureStdout();
    requestContext.run({ requestId: 'r-1', userId: 'u-1' }, () => new AppLogger(false).log('hello', 'Api'));
    const plain = stripVTControlCharacters(lines[0]);
    expect(plain).toContain('[Api] (requestId=r-1 userId=u-1) hello');
  });

  it('logs without ids outside a context and still redacts', () => {
    const lines = captureStdout();
    new AppLogger(true).log('token ghs_' + 'a'.repeat(36));
    const line = JSON.parse(lines[0]);
    expect(line.message).toBe('token [REDACTED]');
    expect(line).not.toHaveProperty('requestId');
  });
});
