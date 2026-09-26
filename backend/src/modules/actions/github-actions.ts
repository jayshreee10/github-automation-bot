import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ConfigService } from '../../core/config/config.service.js';
import { githubFetch } from '../github/github-client.js';
import { InstallationTokenService } from '../github/installation-token.service.js';

const commentSchema = z.object({
  id: z.number(),
  html_url: z.string(),
  body: z.string().nullish(),
  user: z.object({ login: z.string() }).nullable(),
});

const labelsSchema = z.array(z.object({ name: z.string() }));

export interface IssueRef {
  installationId: number;
  repoFullName: string;
  number: number;
}

// Writes to issues and PRs as the App installation. PRs share the issues endpoints for labels and comments.
@Injectable()
export class GithubActions {
  private readonly botLogin: string;

  constructor(
    private readonly tokens: InstallationTokenService,
    config: ConfigService,
  ) {
    this.botLogin = `${config.get('GITHUB_APP_SLUG')}[bot]`;
  }

  // GitHub creates missing labels; adding one already present is a no-op, so a repeat is harmless.
  async addLabels(ref: IssueRef, labels: string[]): Promise<string[]> {
    const result = await this.tokens.withToken(ref.installationId, (token) =>
      githubFetch(`${issuePath(ref)}/labels`, token, labelsSchema, {
        method: 'POST',
        body: JSON.stringify({ labels }),
      }),
    );
    return result.map((l) => l.name);
  }

  async addComment(ref: IssueRef, body: string) {
    const comment = await this.tokens.withToken(ref.installationId, (token) =>
      githubFetch(`${issuePath(ref)}/comments`, token, commentSchema, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    );
    return { id: comment.id, url: comment.html_url };
  }

  // A bot comment carrying the marker, posted at or after `since`. Finds a comment saved before a crash.
  async findComment(ref: IssueRef, marker: string, since: Date) {
    const params = `since=${since.toISOString()}&per_page=100`;
    const comments = await this.tokens.withToken(ref.installationId, (token) =>
      githubFetch(
        `${issuePath(ref)}/comments?${params}`,
        token,
        z.array(commentSchema),
      ),
    );
    const hit = comments.find(
      (c) => c.user?.login === this.botLogin && c.body?.includes(marker),
    );
    return hit ? { id: hit.id, url: hit.html_url } : null;
  }
}

function issuePath(ref: IssueRef): string {
  return `/repos/${ref.repoFullName}/issues/${ref.number}`;
}
