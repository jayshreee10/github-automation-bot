import { z } from 'zod';

export const eventItemSchema = z.object({
  id: z.string(),
  event: z.string(),
  action: z.string().nullable(),
  repository: z.string(),
  title: z.string().nullable(),
  url: z.string().nullable(),
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'dead']),
  attempts: z.number(),
  lastError: z.string().nullable(),
  receivedAt: z.iso.datetime(),
});

// configured is null when GitHub could not be asked; lastDeliveryAt is the newest event for this user.
export const webhookStatusSchema = z.object({
  configured: z.boolean().nullable(),
  lastDeliveryAt: z.iso.datetime().nullable(),
});

export const eventLogSchema = z.object({
  webhook: webhookStatusSchema,
  events: z.array(eventItemSchema),
});

export const eventLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type EventItem = z.infer<typeof eventItemSchema>;
export type EventLog = z.infer<typeof eventLogSchema>;
export type EventLogQuery = z.infer<typeof eventLogQuerySchema>;
