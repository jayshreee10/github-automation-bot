import { describe, expect, it, vi } from 'vitest';
import { HandlerRegistry } from './handler.registry.js';

const handler = (...events: string[]) => ({ events, handle: vi.fn() });

describe('HandlerRegistry', () => {
  it('routes each event to its handler', () => {
    const registry = new HandlerRegistry();
    const repo = handler('issues', 'push');
    registry.register(repo);
    expect(registry.handles('push')).toBe(true);
    expect(registry.get('issues')).toBe(repo);
    expect(registry.handles('star')).toBe(false);
    expect(registry.get('star')).toBeUndefined();
  });

  it('refuses two handlers for the same event', () => {
    const registry = new HandlerRegistry();
    registry.register(handler('issues'));
    expect(() => registry.register(handler('issues'))).toThrow(/Duplicate job handler/);
  });
});
