import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app-logger.js';
import { loadEnv } from './config/env.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const env = loadEnv();
  // rawBody keeps the exact bytes GitHub signed; the webhook HMAC is checked on those, not on parsed JSON.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new AppLogger(env.NODE_ENV === 'production'),
    rawBody: true,
  });
  // Explicit cap: the 100 kB default is too small for push payloads; GitHub caps them at 25 MB.
  app.useBodyParser('json', { limit: '5mb' });
  app.setGlobalPrefix('api');
  // Validates any @Body/@Param/@Query that declares a zod schema; returns 400 on failure.
  app.useGlobalPipes(new StandardSchemaValidationPipe({ transform: true }));
  app.enableShutdownHooks();
  // API docs are dev-only; production exposes no route map.
  if (env.NODE_ENV !== 'production') setupSwagger(app);
  await app.listen(env.PORT);
}
await bootstrap();
