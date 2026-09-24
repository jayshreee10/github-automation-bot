import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app-logger.js';
import { loadEnv } from './config/env.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(env.NODE_ENV === 'production'),
  });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}
await bootstrap();
