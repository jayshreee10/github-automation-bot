import { Controller, Get } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppInfoService } from './app-info.service.js';
import { type GithubApp, githubAppSchema } from './github.types.js';

// Same for every user: what the App may do and which events it receives. Never the webhook URL or secret.
@ApiTags('github')
@ApiBearerAuth()
@Controller('app')
export class AppInfoController {
  constructor(private readonly appInfo: AppInfoService) {}

  @Get()
  @ApiOkResponse({
    description: 'GitHub App permissions and subscribed events',
    standardSchema: githubAppSchema,
  })
  @ApiBadGatewayResponse({ description: 'GitHub unavailable' })
  get(): Promise<GithubApp> {
    return this.appInfo.get();
  }
}
