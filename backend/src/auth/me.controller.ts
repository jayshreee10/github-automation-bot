import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('me')
export class MeController {
  @Get()
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
