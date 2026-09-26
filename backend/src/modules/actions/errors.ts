import { redact } from '../../core/logger/redact.js';
import { GithubApiError } from '../github/github-client.js';

// Retrying later may succeed (network, 5xx, rate limit): the action stays pending and the job retries.
export class TransientActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientActionError';
  }
}

// Retrying cannot help (gone, invalid, misconfigured): the action is marked failed and not run again.
export class PermanentActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentActionError';
  }
}

// Slack Incoming Webhook failure; only the status is kept, the URL is a secret.
export class SlackApiError extends Error {
  constructor(readonly status: number) {
    super(`Slack webhook ${status}`);
    this.name = 'SlackApiError';
  }
}

export type ActionError = TransientActionError | PermanentActionError;

// Maps any failure to the two classes above. Unknown errors (network, timeout) count as transient.
export function toActionError(err: unknown): ActionError {
  if (
    err instanceof TransientActionError ||
    err instanceof PermanentActionError
  )
    return err;
  const message = String(redact(err instanceof Error ? err.message : err));
  if (err instanceof GithubApiError) {
    const s = err.status;
    if (s === 401 || s === 429 || s >= 500 || err.rateLimited)
      return new TransientActionError(message);
    return new PermanentActionError(message);
  }
  if (err instanceof SlackApiError) {
    if (err.status === 429 || err.status >= 500)
      return new TransientActionError(message);
    return new PermanentActionError(message);
  }
  return new TransientActionError(message);
}
