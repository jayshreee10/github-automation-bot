import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { EventsService } from './events.service.js';
import {
  type EventLog,
  eventLogQuerySchema,
  eventLogSchema,
  type EventLogQuery,
} from './events.types.js';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: "Webhook status and the caller's recent events, newest first",
    standardSchema: eventLogSchema,
  })
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: eventLogQuerySchema }) query: EventLogQuery,
  ): Promise<EventLog> {
    return this.events.list(user, query.limit);
  }
}
