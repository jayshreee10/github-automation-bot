import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Serves Swagger UI at /api/docs and the spec at /api/docs-json. Response schemas come from zod.
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('GitHub Automation Bot API')
    .setVersion('0.0.1')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Neon Auth JWT',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });
}
