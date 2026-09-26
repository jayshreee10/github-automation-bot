import { z } from 'zod';
import { InvalidInputError } from '../../core/errors/domain.error.js';

// Keyset position of a delivery: newest-first order is (received_at, id) descending.
export interface Cursor {
  receivedAt: Date;
  id: string;
}

// Opaque to clients; base64url of "<ISO time>|<delivery id>".
export function encodeCursor(cursor: Cursor): string {
  const raw = `${cursor.receivedAt.toISOString()}|${cursor.id}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
}

// Anything that does not round-trip exactly is rejected with 400, so cursors cannot carry other values.
export function decodeCursor(value: string): Cursor {
  const [iso, id, ...rest] = Buffer.from(value, 'base64url')
    .toString('utf8')
    .split('|');
  const receivedAt = new Date(iso);
  const valid =
    rest.length === 0 &&
    z.guid().safeParse(id).success &&
    !Number.isNaN(receivedAt.getTime()) &&
    receivedAt.toISOString() === iso;
  if (!valid) throw new InvalidInputError('invalid cursor');
  return { receivedAt, id };
}
