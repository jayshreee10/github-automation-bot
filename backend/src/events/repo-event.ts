import { z } from 'zod';
import { PermanentJobError } from '../queue/job-errors.js';

// One shape for issues, pull_request and push: the rule matcher's input in phase 4.
export interface RepoEvent {
  deliveryId: string;
  event: 'issues' | 'pull_request' | 'push';
  action: string | null;
  repository: { id: number; fullName: string };
  actor: string;
  number: number | null;
  title: string;
  body: string;
  labels: string[];
  ref: string | null;
  url: string | null;
}

const repositorySchema = z.object({ id: z.number(), full_name: z.string() });
const userSchema = z.object({ login: z.string() });
const labelsSchema = z.array(z.object({ name: z.string() })).default([]);

const issueLikeSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullish(),
  labels: labelsSchema,
  html_url: z.string(),
});

const issuesPayloadSchema = z.object({
  action: z.string(),
  repository: repositorySchema,
  sender: userSchema,
  issue: issueLikeSchema,
});

const pullRequestPayloadSchema = z.object({
  action: z.string(),
  repository: repositorySchema,
  sender: userSchema,
  pull_request: issueLikeSchema.extend({
    head: z.object({ ref: z.string() }),
  }),
});

const pushPayloadSchema = z.object({
  ref: z.string(),
  repository: repositorySchema,
  sender: userSchema,
  compare: z.string().nullish(),
  head_commit: z.object({ message: z.string() }).nullish(),
});

export const REPO_EVENTS = ['issues', 'pull_request', 'push'] as const;

// Throws PermanentJobError on a shape we cannot read: retrying the same payload will not fix it.
export function toRepoEvent(
  deliveryId: string,
  event: string,
  payload: unknown,
): RepoEvent {
  const base = { deliveryId, action: null, number: null, ref: null };
  if (event === 'issues') {
    const p = parse(issuesPayloadSchema, payload);
    return {
      ...base,
      event,
      action: p.action,
      repository: repo(p.repository),
      actor: p.sender.login,
      number: p.issue.number,
      title: p.issue.title,
      body: p.issue.body ?? '',
      labels: p.issue.labels.map((l) => l.name),
      url: p.issue.html_url,
    };
  }
  if (event === 'pull_request') {
    const p = parse(pullRequestPayloadSchema, payload);
    const pr = p.pull_request;
    return {
      ...base,
      event,
      action: p.action,
      repository: repo(p.repository),
      actor: p.sender.login,
      number: pr.number,
      title: pr.title,
      body: pr.body ?? '',
      labels: pr.labels.map((l) => l.name),
      ref: pr.head.ref,
      url: pr.html_url,
    };
  }
  if (event === 'push') {
    const p = parse(pushPayloadSchema, payload);
    const message = p.head_commit?.message ?? '';
    return {
      ...base,
      event,
      repository: repo(p.repository),
      actor: p.sender.login,
      title: message.split('\n', 1)[0],
      body: message,
      labels: [],
      ref: p.ref,
      url: p.compare ?? null,
    };
  }
  throw new PermanentJobError(`not a repo event: ${event}`);
}

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new PermanentJobError('unexpected payload shape');
  return result.data;
}

function repo(r: z.infer<typeof repositorySchema>): RepoEvent['repository'] {
  return { id: r.id, fullName: r.full_name };
}
