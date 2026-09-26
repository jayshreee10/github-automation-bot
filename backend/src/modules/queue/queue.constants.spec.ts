import { describe, expect, it, vi } from 'vitest';
import { backoffMs } from './queue.constants.js';

describe('backoffMs', () => {
  it.each([
    [1, 30_000],
    [2, 120_000],
    [3, 480_000],
    [4, 1_920_000],
  ])('attempt %i waits %i ms before jitter', (attempt, base) => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(backoffMs(attempt)).toBe(base);
  });

  it('adds at most 20 % jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    expect(backoffMs(1)).toBeLessThanOrEqual(36_000);
    expect(backoffMs(1)).toBeGreaterThan(35_000);
  });
});
