# Phase 5 — Dashboard and observability

Give the signed-in user a full view of the bot: a live event log with the actions taken, a rules page to manage what the bot does, and a failures page to see and retry what went wrong. Every log line carries a request id or delivery id so any event can be traced end to end. This is Session 5; it only reads and controls what phases 3–4 produce.

Sources: [`prd.md`](../prd.md) · [`tech-stack.md`](../tech-stack.md) · [`sessions.md`](../sessions.md) (Session 5) · [phase 3](phase-3.md) · [phase 4](phase-4.md)

---

## As built (2026-09-26)

Where the code differs from the plan below, the code wins:

| Plan | Built | Why |
| --- | --- | --- |
| `common/`, `dashboard/`, `pages/` paths | `core/context/`, `modules/events/` (list, detail, stats), `modules/failures/` (list, retry); frontend `features/{shell,events,rules,failures}/` | Matches the core/modules + features layout from the refactor |
| `after=<cursor>` polling | Each poll re-fetches the first page; "Load more" uses `before` | One query returns new rows *and* status changes of recent rows |
| Webhook status on the event log | Moved to `GET /api/stats` | The list response is paged; stats is the per-scope summary |
| Retry only `failed` / `dead` | Also a `succeeded` job with `failed` actions; those actions go back to `pending` in the same transaction | A wrong Slack URL (404) is a permanent action failure, so the job itself succeeds; check 5 needs this |
| Retry clears `last_error` | Kept until the next run overwrites it | Matches "To confirm" row 3 |
| Summary built from the payload in TS | Summary fields selected in SQL, normalised by a pure function | Push payloads can be MBs; the payload never leaves Postgres |
| B12 index on `jobs(status, updated_at)` | Not added | Query plans are fine at this size |
| New rule defaults to the first repo | No default unless `?repo=` is set; the form requires a choice | In the Chrome run a missed dropdown click silently created a rule on the wrong repo |

### End-to-end run (2026-09-26, `test-bot`, Chrome)

| # | Result |
| --- | --- |
| 1 | #16 appeared and showed Label · Comment · Slack succeeded |
| 2 | PR #17 (label + comment) and a push on `phase5-e2e` shown with correct type and summary |
| 3 | "Feature requests" created in the UI, "Bug triage" disabled: #18 got `enhancement` + comment, #19 got nothing |
| 4 | Wrong Slack URL: #20 listed on Failures with `Slack webhook 404`, job `succeeded` |
| 5 | Slack fixed, Retry: only `slack_notify` ran; still one comment and one `bug` label |
| 6 | Dead phase 3 job retried: `pending` → `succeeded`; a second request returned `409` |
| 7 | Filter on `github-automation-bot`: events, rules, failures scoped; kept across nav and reload |
| 8 | 0 polls in 25–45 s hidden; 4 polls in 12 s visible; resumes on show |
| 9 | Webhook line: request id + delivery id; handler, action and worker lines: delivery id + job id |
| 10 | Foreign delivery/job (temporary fixture) → `404`, absent from lists and stats; no or forged JWT → `401` |

The Chrome window was occluded, so "visible" was simulated by overriding `document.hidden` and firing `visibilitychange`, the same path a real tab switch takes.

---

## 1. Scope

| In scope                                                                            | Out of scope (later phases)                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| Read APIs: events (keyset-paged), event detail, failures, summary counts             | Websockets / server-sent events (excluded)          |
| Manual retry of `failed` / `dead` jobs                                               | Rate limiting, hosting (Session 6)                 |
| Event log page, live via short polling (paused when the tab is hidden)               | AI triage column (Session 7)                       |
| Rules page: list, create, edit, enable/disable, delete                               | Rule dry-run / preview against past events         |
| Failures page: failed/dead jobs and failed actions with error and attempts           | Payload retention / cleanup                        |
| Repository filter across all pages (multi-repo)                                      | Charts                                             |
| Request id per HTTP request, delivery id per job, in every log line                  |                                                    |

### PRD requirements covered

| PRD item                                   | How this phase covers it                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Core 6 — dashboard behind login            | All pages under the existing protected route; every read API needs the JWT            |
| Stretch 1 — configurable rules in the UI   | Rules page over phase 4's CRUD API                                                   |
| Stretch 4 — multi-repo                     | Repo filter on events, rules, failures                                                |
| Stretch 5 — observability                  | Failure history with attempts and errors, manual retry, correlated structured logs    |
| Quality 4 — never expose secrets           | APIs return a trimmed event summary, never raw payloads or error text with secrets   |

---

## 2. How the flow works

### Live event log

```mermaid
sequenceDiagram
    actor U as User
    participant SPA as React SPA
    participant API as NestJS API
    participant DB as Neon Postgres

    U->>SPA: Open dashboard (?repo=optional)
    SPA->>API: GET /api/events?repositoryId&limit=25
    API->>DB: deliveries ⋈ repos ⋈ installations WHERE user_id = caller, newest first
    API-->>SPA: items (event, action, title, job status, actions[]) + nextCursor
    loop every 5 s while the tab is visible
        SPA->>API: GET /api/events?after=<newest cursor>
        API-->>SPA: only newer items (usually empty)
        SPA->>SPA: prepend new items; refresh rows still pending/running
    end
    U->>SPA: "Load more"
    SPA->>API: GET /api/events?before=<oldest cursor>
```

### Manual retry

```mermaid
sequenceDiagram
    actor U as User
    participant SPA as React SPA
    participant API as NestJS API
    participant DB as Neon Postgres
    participant W as Worker

    U->>SPA: Failures → "Retry"
    SPA->>API: POST /api/jobs/:id/retry
    API->>DB: UPDATE jobs SET status=pending, attempts=0, next_run_at=now(), last_error=null<br/>WHERE id AND status IN (failed, dead) AND owned by caller
    API-->>SPA: 202 (or 409 if not failed/dead)
    W->>DB: claims the job on the next poll
    W->>W: succeeded actions are skipped (phase 4); only failed ones run again
```

**Key rules**

- Every read goes through repo → installation → `user_id = caller`. Deliveries with no repository (installation events) are not shown.
- Cursors are opaque base64 of `(received_at, id)`; keyset paging, never `OFFSET`.
- The API returns a **summary** built from the payload (title, number, URL, author, ref), never the raw payload. Action `error` text is already redacted when stored (phase 4).
- Retry is a conditional `UPDATE`: a double click or a job already `pending` returns `409`, so it can never run twice at once.
- Polling stops when `document.visibilityState` is `hidden` and on unmount (`AbortController`), and backs off to 30 s after repeated errors.
- The selected repo lives in the URL (`?repo=<id>`) so reload and shared links keep it. Zustand is not needed for this.

### API

| Method | Path                         | Returns                                                                                     |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------- |
| GET    | `/api/events`                | `{ items, nextCursor }`; query `repositoryId`, `event`, `status`, `before`, `after`, `limit ≤ 100` |
| GET    | `/api/events/:deliveryId`    | Summary + job (status, attempts, next run, last error) + actions (rule, type, status, result/error) |
| GET    | `/api/failures`              | Jobs `failed`/`dead` and actions `failed`, newest first; query `repositoryId`              |
| POST   | `/api/jobs/:id/retry`        | `202` / `404` not owned / `409` not retryable                                              |
| GET    | `/api/stats`                 | Last 24 h: events, actions succeeded/failed, jobs dead; query `repositoryId`               |
| —      | `/api/rules`                 | Phase 4 CRUD (unchanged)                                                                    |

---

## 3. What you need to do (manual steps)

None. Phases 2–4 must be working, with at least one rule on [`jayshreee10/test-bot`](https://github.com/jayshreee10/test-bot). Tell Claude "start phase 5".

---

## 4. What Claude builds

### Packages

| Package              | Where    | Why                                                                     |
| -------------------- | -------- | ----------------------------------------------------------------------- |
| shadcn components    | frontend | `table`, `badge`, `card`, `select`, `input`, `textarea`, `switch`, `checkbox`, `dialog`, `alert-dialog`, `tabs`, `skeleton`, `sonner` (generated, not npm deps beyond `sonner`) |

No data-fetching library: a small polling hook on top of the existing `lib/api.ts` is enough. Request context uses Node's `AsyncLocalStorage`.

### Backend (`backend/src/`)

| #   | File                                        | What it does                                                                                                                         |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | `common/request-context.ts`                 | `AsyncLocalStorage<{ requestId?, deliveryId?, jobId?, userId? }>` with `run` / `get`                                                   |
| B2  | `common/request-id.middleware.ts`           | Reuses an incoming `X-Request-Id` if it is a UUID, else generates one; sets the response header; runs the request in the context       |
| B3  | `common/logger/app-logger.ts`               | Adds context ids to every line (JSON fields in prod, prefix in dev)                                                                  |
| B4  | `queue/worker.service.ts`, `webhooks/webhooks.controller.ts` | Worker runs each job inside the context with `deliveryId` + `jobId`; webhook sets `deliveryId` once headers pass              |
| B5  | `dashboard/event-summary.ts`                | Pure: payload → `{ title, number, url, author, ref }` per event type                                                                 |
| B6  | `dashboard/cursor.ts`                       | Encode/decode `(received_at, id)` cursors; invalid → `400`                                                                           |
| B7  | `dashboard/dashboard.types.ts`              | zod query schemas and response schemas (Swagger via Standard Schema)                                                                 |
| B8  | `dashboard/events.service.ts`               | List (keyset, filters, ownership join), detail with job and actions                                                                  |
| B9  | `dashboard/failures.service.ts`             | Failed/dead jobs and failed actions; `retry(user, jobId)` conditional update                                                          |
| B10 | `dashboard/stats.service.ts`                | 24 h counts with `groupBy`                                                                                                            |
| B11 | `dashboard/dashboard.controller.ts`, `dashboard.module.ts` | Routes from the API table; `@ApiBearerAuth()`                                                                           |
| B12 | `prisma/schema.prisma` + migration          | Only if query plans need it: index on `jobs(status, updated_at)` for the failures page                                               |

### Frontend (`frontend/src/`)

| #   | File                                                        | What it does                                                                                                   |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| F1  | `lib/schemas.ts`                                            | Event, event detail, failure, stats, rule schemas (rule fields match phase 4's `rule.schema.ts`)               |
| F2  | `lib/use-polling.ts`                                        | `usePolling(fetcher, ms)`: abort on unmount, pause when hidden, back off on errors                             |
| F3  | `components/app-shell.tsx`                                  | Header with nav (Events · Rules · Failures · Repositories), repo filter select, user menu / sign out           |
| F4  | `components/repo-filter.tsx`                                | Select bound to `?repo=`; lists the user's repos from `/api/repositories`                                      |
| F5  | `pages/events-page.tsx`, `components/event-table.tsx`, `components/status-badge.tsx` | Stats cards + live table: time, repo, event, title link, job status, action chips; "Load more" |
| F6  | `components/event-detail-dialog.tsx`                         | Job attempts, next run, last error, each action with result or error                                           |
| F7  | `pages/rules-page.tsx`, `components/rule-list.tsx`           | Rules per repo with enable switch, edit, delete (confirm dialog)                                               |
| F8  | `pages/rule-form-page.tsx`, `components/rule-form.tsx`       | Create/edit: event, action filter, keyword/author/label/branch lists, action toggles; zod errors inline         |
| F9  | `pages/failures-page.tsx`, `components/failure-table.tsx`    | Failed/dead jobs and failed actions, attempts, error, "Retry" with toast                                       |
| F10 | `router.tsx`                                                | `/` events, `/rules`, `/rules/new`, `/rules/:id`, `/failures`, `/repositories` inside `AppShell`               |
| F11 | `styles/components/*.css`                                    | `shell.css`, `events.css`, `rules.css`, `failures.css` — semantic classes via `@apply`                          |

### Order of work (one commit each)

1. B1–B4 request/delivery ids in logs.
2. B5–B11 read APIs + retry → checked in Swagger.
3. F1–F4, F10 app shell, nav, repo filter.
4. F5–F6 events page with polling.
5. F7–F8 rules pages.
6. F9 failures page + retry.
7. End-to-end run on `test-bot`, session logs, docs update.

---

## 5. Environment variables

None new.

---

## 6. Security checklist

- [ ] Every dashboard query joins to `installations.user_id = caller`; another user's delivery / job id → `404`.
- [ ] Raw payloads are never returned; summaries only.
- [ ] Error strings shown in the UI come from redacted `actions.error` / `jobs.last_error`.
- [ ] Retry endpoint is owned-only and conditional (no double enqueue).
- [ ] Incoming `X-Request-Id` accepted only as a UUID (no log injection).
- [ ] Rendered issue titles are plain text (React escapes; no `dangerouslySetInnerHTML`).
- [ ] No new `VITE_*` secrets; `/check-secrets` clean.

---

## 7. Done when (verify together on `test-bot` with `gh`)

| #   | Check                                                                                          | Expected                                                             |
| --- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Dashboard open; `gh issue create -R jayshreee10/test-bot --title "bug: …"`                      | New row appears within ~5 s, then shows 3 succeeded actions         |
| 2   | Open a PR and push a commit on `test-bot`                                                       | Both appear with correct event type and summary                      |
| 3   | Rules page: create "feature" rule, disable the "bug" rule, open matching issues                | Only the enabled rule acts; label/comment visible via `gh issue view` |
| 4   | Break Slack (wrong URL), open a "bug" issue                                                     | Failures page shows the failed Slack action with its error          |
| 5   | Fix Slack, press "Retry" on that job                                                            | Only Slack re-sends; label/comment not repeated                      |
| 6   | Force a job to `dead` (phase 3 test switch), retry it                                           | Returns to `pending` → `succeeded`; second click returns `409`       |
| 7   | Connect a second repo, switch the repo filter                                                   | Events, rules, failures show only that repo; reload keeps the filter |
| 8   | Leave the tab hidden for a minute (Network tab)                                                 | No polling requests while hidden                                    |
| 9   | Backend logs for one issue                                                                      | Webhook, job and action lines share the delivery id; API lines have a request id |
| 10  | `curl` `/api/events/<id>` and `/api/jobs/<id>/retry` for another user's data, and without a JWT | `404` and `401`                                                      |

Clean up afterwards: `gh issue close` / `gh pr close --delete-branch`.

---

## 8. To confirm while building

| Question                                                           | Why it matters                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Polling interval 5 s vs Neon free-tier compute hours               | Hidden-tab pause keeps idle cost near zero; raise to 10 s if needed             |
| Refresh rows still `pending`/`running` in the same poll or a 2nd call | Plan: `after` query also returns items updated since the cursor               |
| Retry resets `attempts` to 0 or keeps history                      | Plan: reset attempts, keep previous error in the job detail until overwritten   |
| Does Nest 12 middleware + `AsyncLocalStorage` survive into the worker's `@Interval` | Worker sets its own context per job, so it doesn't rely on it     |
| Show installation events (repo added/removed) in the log?           | Plan: no; the Repositories page already reflects them                           |

---

## 9. Follow-ups in `sessions.md`

- Session 5: link this plan.
- Session 6: README screenshots of events, rules, failures; tester instructions use these pages with `test-bot`.
- Session 7: AI summary / priority column in the event table and detail dialog.

---

## References

- [Node `AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [NestJS middleware](https://docs.nestjs.com/middleware)
- [Keyset pagination (Use The Index, Luke)](https://use-the-index-luke.com/no-offset)
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [shadcn/ui components](https://ui.shadcn.com/docs/components)
