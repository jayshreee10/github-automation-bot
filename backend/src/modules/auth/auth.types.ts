import type { Request } from 'express';
import { z } from 'zod';

// Single source for the type and its OpenAPI schema.
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
