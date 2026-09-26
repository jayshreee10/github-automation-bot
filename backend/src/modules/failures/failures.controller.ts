import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import {
  type RepositoryFilter,
  repositoryFilterSchema,
} from '../events/events.types.js';
import {
  type FailureList,
  failureListSchema,
  jobIdParamSchema,
  retryResponseSchema,
} from './failures.types.js';
import { FailuresService } from './failures.service.js';

@ApiTags('failures')
@ApiBearerAuth()
@Controller()
export class FailuresController {
  constructor(private readonly failures: FailuresService) {}

  @Get('failures')
  @ApiQuery({ name: 'repositoryId', required: false, type: String })
  @ApiOkResponse({
    description:
      'Failed or dead jobs and jobs with failed actions, newest first',
    standardSchema: failureListSchema,
  })
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: repositoryFilterSchema }) query: RepositoryFilter,
  ): Promise<FailureList> {
    return this.failures.list(user.id, query.repositoryId);
  }

  @Post('jobs/:id/retry')
  @HttpCode(202)
  @ApiAcceptedResponse({
    description: 'Queued; only failed actions run again',
    standardSchema: retryResponseSchema,
  })
  @ApiNotFoundResponse({ description: 'Unknown or not the caller’s' })
  @ApiConflictResponse({
    description: 'Job is not failed, dead, or done with failed actions',
  })
  async retry(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: jobIdParamSchema }) id: string,
  ): Promise<{ queued: true }> {
    await this.failures.retry(user.id, id);
    return { queued: true };
  }
}
