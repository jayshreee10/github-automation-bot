// Dev only: forwards the smee.io channel (SMEE_URL in .env) to the local webhook route.
import { SmeeClient } from 'smee-client';

process.loadEnvFile('.env');
const source = process.env.SMEE_URL;
if (!source) {
  console.error('SMEE_URL is not set in backend/.env');
  process.exit(1);
}
const target = `http://localhost:${process.env.PORT ?? 4000}/api/webhooks/github`;
await new SmeeClient({ source, target, logger: console }).start();
