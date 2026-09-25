import { z } from 'zod';

// Events stored and queued. Everything else is acknowledged with 204 and dropped.
export const HANDLED_EVENTS = new Set([
  'issues',
  'pull_request',
  'push',
  'installation',
  'installation_repositories',
]);

// Header names arrive lower-cased from Node. Delivery ids are GUIDs, so any other shape is rejected.
export const webhookHeadersSchema = z.object({
  'x-github-delivery': z.guid(),
  'x-github-event': z
    .string()
    .regex(/^[a-z_]+$/)
    .max(64),
});

// Only the fields ingestion needs; handlers parse their own event shapes.
export const webhookEnvelopeSchema = z.object({
  action: z.string().max(64).optional(),
  installation: z.object({ id: z.number().int().positive() }).optional(),
  repository: z.object({ id: z.number().int().positive() }).optional(),
});

export type WebhookHeaders = z.infer<typeof webhookHeadersSchema>;

export type IngestResult = 'accepted' | 'duplicate' | 'ignored' | 'ping';

export const ingestResponseSchema = z.object({
  accepted: z.boolean().optional(),
  duplicate: z.boolean().optional(),
  ping: z.boolean().optional(),
});
