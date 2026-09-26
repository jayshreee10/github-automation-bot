import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import {
  type CreateRuleBody,
  createRuleSchema,
  type Rule,
  ruleIdParamSchema,
  type RuleListQuery,
  ruleListQuerySchema,
  ruleSchema,
  type UpdateRuleBody,
  updateRuleSchema,
} from './rule.schema.js';
import { RulesService } from './rules.service.js';

const inputSchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }) as object;

// Rules are scoped to the caller's repos; another user's rule or repo id returns 404.
@ApiTags('rules')
@ApiBearerAuth()
@Controller('rules')
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  @ApiQuery({ name: 'repositoryId', required: false, type: String })
  @ApiOkResponse({
    description: "The caller's rules, oldest first, with fired counts",
    standardSchema: z.array(ruleSchema),
  })
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: ruleListQuerySchema }) query: RuleListQuery,
  ): Promise<Rule[]> {
    return this.rules.list(user.id, query.repositoryId);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'One rule', standardSchema: ruleSchema })
  @ApiNotFoundResponse({ description: 'Rule not found' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: ruleIdParamSchema }) id: string,
  ): Promise<Rule> {
    return this.rules.get(user.id, id);
  }

  @Post()
  @ApiBody({ schema: inputSchema(createRuleSchema) })
  @ApiCreatedResponse({
    description: 'Created rule',
    standardSchema: ruleSchema,
  })
  @ApiBadRequestResponse({ description: 'Invalid rule' })
  @ApiNotFoundResponse({
    description: 'Repository not connected by the caller',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createRuleSchema }) body: CreateRuleBody,
  ): Promise<Rule> {
    return this.rules.create(user.id, body);
  }

  @Patch(':id')
  @ApiBody({ schema: inputSchema(updateRuleSchema) })
  @ApiOkResponse({ description: 'Updated rule', standardSchema: ruleSchema })
  @ApiBadRequestResponse({ description: 'Invalid rule after the update' })
  @ApiNotFoundResponse({ description: 'Rule not found' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: ruleIdParamSchema }) id: string,
    @Body({ schema: updateRuleSchema }) body: UpdateRuleBody,
  ): Promise<Rule> {
    return this.rules.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Rule deleted' })
  @ApiNotFoundResponse({ description: 'Rule not found' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: ruleIdParamSchema }) id: string,
  ): Promise<void> {
    return this.rules.remove(user.id, id);
  }
}
