import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { EventsService } from './events.service.js';
import {
  deliveryIdParamSchema,
  type EventDetail,
  eventDetailSchema,
  type EventListQuery,
  eventListQuerySchema,
  type EventPage,
  eventPageSchema,
  type RepositoryFilter,
  repositoryFilterSchema,
  type Stats,
  statsSchema,
} from './events.types.js';

// Read-only views over the caller's deliveries. Payloads are summarised, never returned raw.
@ApiTags('events')
@ApiBearerAuth()
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get('events')
  @ApiQuery({ name: 'repositoryId', required: false, type: String })
  @ApiQuery({
    name: 'event',
    required: false,
    enum: ['issues', 'pull_request', 'push'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'running', 'succeeded', 'failed', 'dead'],
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Title, author or delivery id prefix',
  })
  @ApiQuery({ name: 'before', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: "The caller's events, newest first, with the actions taken",
    standardSchema: eventPageSchema,
  })
  @ApiBadRequestResponse({ description: 'Invalid filter or cursor' })
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: eventListQuerySchema }) query: EventListQuery,
  ): Promise<EventPage> {
    return this.events.list(user.id, query);
  }

  @Get('events/:deliveryId')
  @ApiOkResponse({
    description: 'One event with its job and every action result',
    standardSchema: eventDetailSchema,
  })
  @ApiNotFoundResponse({ description: 'Unknown or not the caller’s' })
  detail(
    @CurrentUser() user: AuthUser,
    @Param('deliveryId', { schema: deliveryIdParamSchema }) id: string,
  ): Promise<EventDetail> {
    return this.events.detail(user.id, id);
  }

  @Get('stats')
  @ApiQuery({ name: 'repositoryId', required: false, type: String })
  @ApiOkResponse({
    description:
      'Last 24 hours: events, action outcomes, dead jobs; webhook status',
    standardSchema: statsSchema,
  })
  stats(
    @CurrentUser() user: AuthUser,
    @Query({ schema: repositoryFilterSchema }) query: RepositoryFilter,
  ): Promise<Stats> {
    return this.events.stats(user.id, query.repositoryId);
  }
}
