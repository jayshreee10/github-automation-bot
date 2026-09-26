import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { InstallationsService } from './installations.service.js';
import {
  type ConnectBody,
  connectBodySchema,
  installationIdParamSchema,
  type RepositoryList,
  repositoryListSchema,
} from './installations.types.js';

@ApiTags('installations')
@ApiBearerAuth()
@Controller()
export class InstallationsController {
  constructor(private readonly installations: InstallationsService) {}

  @Post('installations')
  @HttpCode(200)
  @ApiBody({
    schema: z.toJSONSchema(connectBodySchema, {
      target: 'openapi-3.0',
      io: 'input',
    }) as object,
  })
  @ApiOkResponse({
    description: "The caller's repositories after connecting",
    standardSchema: repositoryListSchema,
  })
  @ApiForbiddenResponse({
    description: 'Installation unknown or not owned by the caller',
  })
  @ApiBadGatewayResponse({ description: 'GitHub unavailable' })
  connect(
    @CurrentUser() user: AuthUser,
    @Body({ schema: connectBodySchema }) body: ConnectBody,
  ): Promise<RepositoryList> {
    return this.installations.connect(user.id, body.installationId);
  }

  @Post('installations/:id/sync')
  @HttpCode(200)
  @ApiOkResponse({
    description: "The caller's repositories after re-sync",
    standardSchema: repositoryListSchema,
  })
  @ApiForbiddenResponse({ description: 'Installation not owned by the caller' })
  sync(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: installationIdParamSchema }) id: number,
  ): Promise<RepositoryList> {
    return this.installations.sync(user.id, id);
  }

  @Get('repositories')
  @ApiOkResponse({
    description: "The caller's connected repositories",
    standardSchema: repositoryListSchema,
  })
  list(@CurrentUser() user: AuthUser): Promise<RepositoryList> {
    return this.installations.list(user.id);
  }
}
