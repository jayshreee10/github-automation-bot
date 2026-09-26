import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '../config/config.service.js';
import { PrismaClient } from '../../generated/prisma/client.js';

// pg closes idle connections after 10 s by default; reopening one to Neon costs several round trips.
const IDLE_TIMEOUT_MS = 5 * 60_000;

// One pooled client per process. Connects lazily on first query; closed last on shutdown, after the worker drains.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnApplicationShutdown
{
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL'),
        idleTimeoutMillis: IDLE_TIMEOUT_MS,
      }),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
