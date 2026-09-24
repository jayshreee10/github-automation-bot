import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Same env loading as the app: Node's built-in loader, no dotenv.
if (existsSync('.env')) process.loadEnvFile('.env');

// Migrations need a direct connection (advisory locks); Neon's direct host is the pooled host without "-pooler".
function directUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hostname = parsed.hostname.replace('-pooler.', '.');
  return parsed.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: directUrl(env('DATABASE_URL')) },
});
