import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { ActionRunner } from './action-runner.js';
import { ActionsRepository } from './actions.repository.js';
import { GithubActions } from './github-actions.js';
import { SlackNotifier } from './slack-notifier.js';

@Module({
  imports: [GithubModule],
  providers: [ActionsRepository, ActionRunner, GithubActions, SlackNotifier],
  exports: [ActionRunner, ActionsRepository],
})
export class ActionsModule {}
