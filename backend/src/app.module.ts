import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
