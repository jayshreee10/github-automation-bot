import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../../../core/errors/domain.error.js';
import { decodeCursor, encodeCursor } from '../../../modules/events/cursor.js';

const ID = '72d3162e-cc78-11e3-81ab-4c9367dc0958';
const b64 = (s: string) => Buffer.from(s).toString('base64url');

describe('cursor', () => {
  it('round-trips time and delivery id', () => {
    const cursor = { receivedAt: new Date('2026-01-02T03:04:05.678Z'), id: ID };
    const encoded = encodeCursor(cursor);
    expect(encoded).not.toContain(ID);
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it.each([
    ['garbage', 'not-a-cursor'],
    ['a bad time', b64(`yesterday|${ID}`)],
    ['a non-canonical time', b64(`2026-01-02|${ID}`)],
    ['a non-GUID id', b64(`2026-01-02T03:04:05.678Z|1 OR 1=1`)],
    ['extra fields', b64(`2026-01-02T03:04:05.678Z|${ID}|x`)],
    ['empty', ''],
  ])('rejects %s with a 400-mapped error', (_, value) => {
    expect(() => decodeCursor(value)).toThrow(InvalidInputError);
  });
});
