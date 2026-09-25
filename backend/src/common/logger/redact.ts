const MASK = '[REDACTED]';

const SENSITIVE_KEY =
  /token|secret|password|passwd|authorization|cookie|signature|api[-_]?key|private[-_]?key|database_url/i;

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]+/g,
  /https:\/\/hooks\.slack\.com\/services\/\S+/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

// Masks credentials in URLs like postgres://user:pass@host, keeping user and host visible.
const URL_PASSWORD = /(\b[a-z][a-z0-9+.-]*:\/\/[^:/\s]+:)[^@\s]+@/gi;

// Exact secret values registered at boot (e.g. the webhook secret), masked wherever they appear.
const EXACT_SECRETS = new Set<string>();

export function redactExact(secret: string): void {
  if (secret.length >= 8) EXACT_SECRETS.add(secret);
}

function redactString(value: string): string {
  let out = value.replace(URL_PASSWORD, `$1${MASK}@`);
  for (const pattern of SENSITIVE_PATTERNS) out = out.replace(pattern, MASK);
  for (const secret of EXACT_SECRETS) out = out.replaceAll(secret, MASK);
  return out;
}

// Recursively masks secrets by key name and by value pattern. Returns a copy; never mutates input.
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Error) {
    const copy = new Error(redactString(value.message));
    copy.name = value.name;
    copy.stack = value.stack && redactString(value.stack);
    return copy;
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? MASK : redact(v, seen);
  }
  return out;
}
