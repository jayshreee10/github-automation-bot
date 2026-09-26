import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GithubIdentityService } from '../users/github-identity.service.js';
import { type AuthUser, type Me, meSchema } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly identity: GithubIdentityService) {}

  @Get()
  @ApiOkResponse({
    description: 'The signed-in user, with their GitHub login when known',
    standardSchema: meSchema,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Neon Auth JWT' })
  async me(@CurrentUser() user: AuthUser): Promise<Me> {
    return { ...user, githubLogin: await this.identity.githubLogin(user.id) };
  }
}
