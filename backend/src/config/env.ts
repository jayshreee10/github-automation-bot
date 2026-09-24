import { existsSync } from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
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
  cached = Object.freeze(result.data);
  return cached;
}
