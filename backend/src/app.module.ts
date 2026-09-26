import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './core/config/config.module.js';
import { PrismaModule } from './core/database/prisma.module.js';
import { ErrorsModule } from './core/errors/errors.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InstallationsModule } from './modules/installations/installations.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';

// Composition root: core infrastructure first, then feature modules.
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    PrismaModule,
    ErrorsModule,
    HealthModule,
    AuthModule,
    QueueModule,
    InstallationsModule,
    EventsModule,
    WebhooksModule,
  ],
})
export class AppModule {}
