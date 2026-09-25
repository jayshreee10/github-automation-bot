import { Module } from '@nestjs/common';
import { GithubIdentityService } from './github-identity.service.js';

@Module({
  providers: [GithubIdentityService],
  exports: [GithubIdentityService],
})
export class UsersModule {}
