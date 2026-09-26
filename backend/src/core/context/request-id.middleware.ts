import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { requestContext } from './request-context.js';

export const REQUEST_ID_HEADER = 'x-request-id';

const isUuid = (value: unknown): value is string =>
  z.uuid().safeParse(value).success;

// Reuses a caller's X-Request-Id only when it is a UUID, so arbitrary text never reaches the logs.
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId = isUuid(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  requestContext.run({ requestId }, next);
}
