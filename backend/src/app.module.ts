import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './core/config/config.module.js';
import { requestIdMiddleware } from './core/context/request-id.middleware.js';
import { PrismaModule } from './core/database/prisma.module.js';
import { ErrorsModule } from './core/errors/errors.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { FailuresModule } from './modules/failures/failures.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InstallationsModule } from './modules/installations/installations.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { RulesModule } from './modules/rules/rules.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';

// Composition root: core infrastructure first, then feature modules.
// Module middleware runs after the body parsers, so the request context is not lost inside their stream callbacks.
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
    FailuresModule,
    RulesModule,
    WebhooksModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('{*splat}');
  }
}
