export const POLL_INTERVAL_MS = 2_000;
export const BATCH_SIZE = 5;
export const MAX_ATTEMPTS = 5;
// A running job untouched this long belongs to a crashed process and is claimed again.
export const STALE_LOCK_MS = 5 * 60_000;
export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_JITTER = 0.2;
export const LAST_ERROR_MAX = 500;

// 30 s × 4^(attempt−1): 30 s, 2 min, 8 min, 32 min, plus up to 20 % jitter.
export function backoffMs(attempt: number): number {
  const base = BACKOFF_BASE_MS * 4 ** (attempt - 1);
  return Math.round(base * (1 + Math.random() * BACKOFF_JITTER));
}
