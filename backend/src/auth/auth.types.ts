import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
