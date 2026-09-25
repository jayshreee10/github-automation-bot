import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

const healthSchema = z.object({ status: z.literal('ok'), db: z.literal('ok') });

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOkResponse({
    description: 'API and database are up',
    standardSchema: healthSchema,
  })
  @ApiServiceUnavailableResponse({ description: 'Database unreachable' })
  async check(): Promise<z.infer<typeof healthSchema>> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      this.logger.error(`DB check failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException();
    }
    return { status: 'ok', db: 'ok' };
  }
}
