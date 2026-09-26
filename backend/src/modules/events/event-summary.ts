import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';

const TITLE_MAX = 200;

// What the dashboard shows for a delivery. Built from a few payload fields; the raw payload is never returned.
export const eventSummarySchema = z.object({
  title: z.string().nullable(),
  number: z.number().int().nullable(),
  url: z.string().nullable(),
  author: z.string().nullable(),
  ref: z.string().nullable(),
});

export type EventSummary = z.infer<typeof eventSummarySchema>;

export interface SummaryColumns {
  summaryTitle: string | null;
  summaryNumber: string | null;
  summaryUrl: string | null;
  summaryAuthor: string | null;
  summaryRef: string | null;
}

// Issue or PR title, or the commit message for a push. Also used by the event search.
export const SUMMARY_TITLE = Prisma.sql`COALESCE(d.payload->'issue'->>'title',
  d.payload->'pull_request'->>'title', d.payload->'head_commit'->>'message')`;

// Select list over webhook_deliveries d: only these fields leave the database, never the payload itself.
export const SUMMARY_COLUMNS = Prisma.sql`
  ${SUMMARY_TITLE} AS "summaryTitle",
  COALESCE(d.payload->'issue'->>'number', d.payload->'pull_request'->>'number') AS "summaryNumber",
  COALESCE(d.payload->'issue'->>'html_url', d.payload->'pull_request'->>'html_url',
           d.payload->>'compare') AS "summaryUrl",
  d.payload->'sender'->>'login' AS "summaryAuthor",
  COALESCE(d.payload->'pull_request'->'head'->>'ref', d.payload->>'ref') AS "summaryRef"`;

// Pure: first line of the title (commit messages are multi-line), GitHub links only, branch without refs/heads/.
export function toEventSummary(c: SummaryColumns): EventSummary {
  const title = c.summaryTitle?.split('\n', 1)[0].trim().slice(0, TITLE_MAX);
  const number = Number(c.summaryNumber);
  return {
    title: title || null,
    number: c.summaryNumber && Number.isInteger(number) ? number : null,
    url: c.summaryUrl?.startsWith('https://github.com/') ? c.summaryUrl : null,
    author: c.summaryAuthor,
    ref: c.summaryRef?.replace(/^refs\/heads\//, '') ?? null,
  };
}
