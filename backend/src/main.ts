import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppLogger } from './common/logger/app-logger.js';
import { loadEnv } from './config/env.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(env.NODE_ENV === 'production'),
  });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  // API docs are dev-only; production exposes no route map.
  if (env.NODE_ENV !== 'production') setupSwagger(app);
  await app.listen(env.PORT);
}
await bootstrap();
