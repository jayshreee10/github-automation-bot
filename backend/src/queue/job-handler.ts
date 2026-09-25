import type { WebhookDelivery } from '../generated/prisma/client.js';

// Processes one stored delivery. Must be safe to run twice: a crash can land after the side effect.
// Throw PermanentJobError when retrying cannot help; any other error is retried with backoff.
export interface JobHandler {
  readonly events: readonly string[];
  handle(delivery: WebhookDelivery): Promise<void>;
}
