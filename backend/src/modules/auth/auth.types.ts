import type { Request } from 'express';
import { z } from 'zod';

// Single source for the type and its OpenAPI schema.
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

// githubLogin comes from the caller's own installation; null until they install the App.
export const meSchema = authUserSchema.extend({
  githubLogin: z.string().nullable(),
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type Me = z.infer<typeof meSchema>;

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
