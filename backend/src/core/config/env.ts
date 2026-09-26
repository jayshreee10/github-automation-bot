import { createPrivateKey } from 'node:crypto';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { redactExact } from '../logger/redact.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  NEON_AUTH_URL: z.url({ protocol: /^https$/ }),
  GITHUB_APP_ID: z.coerce.number().int().positive(),
  GITHUB_APP_SLUG: z.string().regex(/^[a-z0-9-]+$/),
  // Base64 of the App's .pem on one line; decoded and parsed at boot so a bad key fails fast.
  GITHUB_APP_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((b64, ctx) => {
      try {
        return createPrivateKey(Buffer.from(b64, 'base64').toString('utf8'));
      } catch {
        ctx.addIssue({ code: 'custom', message: 'not a valid base64 PEM key' });
        return z.NEVER;
      }
    }),
  // Secret. Same value as the App's webhook secret; HMAC key for X-Hub-Signature-256.
  GITHUB_WEBHOOK_SECRET: z.string().min(32),
  // Dev only: smee.io channel that `npm run webhooks` forwards to localhost.
  SMEE_URL: z.url({ protocol: /^https$/ }).optional(),
  // Dev only: jobs for this event throw a transient error, to exercise retries. Ignored in production.
  QUEUE_FAIL_EVENT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

// Parses env once at boot. On failure, prints only variable names (never values) and exits.
export function loadEnv(): Env {
  if (cached) return cached;
  if (existsSync('.env')) process.loadEnvFile('.env');

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const names = result.error.issues.map((i) => i.path.join('.'));
    console.error(`Invalid or missing env vars: ${names.join(', ')}`);
    process.exit(1);
  }
  // Random secrets match no pattern, so the logger masks their exact value.
  redactExact(result.data.GITHUB_WEBHOOK_SECRET);
  cached = Object.freeze(result.data);
  return cached;
}
