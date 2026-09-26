import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type AuthUser, authUserSchema } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  @ApiOkResponse({
    description: 'The signed-in user',
    standardSchema: authUserSchema,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Neon Auth JWT' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
