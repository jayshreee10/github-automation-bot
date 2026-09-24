import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';

// Liveness only for now; the database check is added with Prisma in Session 1.
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
