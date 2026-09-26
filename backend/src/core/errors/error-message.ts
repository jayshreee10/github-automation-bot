// Safe message extraction for logs; catch clauses receive unknown, not Error.
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
