# Build Plan — Sessions

How this project is built, one session at a time. Each session ends with working, committed code and an updated `CLAUDE.md` / `AGENTS.md`.

Source spec: [`prd.md`](prd.md)
Workflow commands: [`commands.md`](commands.md)
Tech stack: [`tech-stack.md`](tech-stack.md)

---

## Architecture

```
 GitHub ──webhook──▶ NestJS API ──▶ Neon Postgres
   ▲                    │   ▲                  (events, jobs, rules, actions)
   │  label / comment   │   │ /api/* proxied
   └────────────────────┘   │
                            │
 Browser ──▶ Next.js web ─────rewrites──┘
                            │
 NestJS worker ──▶ Slack Incoming Webhook, Groq/Gemini (AI)
```

- **Next.js (`frontend/`)** — sign-in page, dashboard, rules UI.
- **NestJS (`backend/`)** — OAuth, webhooks, job queue worker, GitHub/Slack/AI calls. Runs as a long-lived process, so the worker lives in-process.
- **Same-origin cookies:** Next.js rewrites `/api/*` to the Nest API, so the browser only sees the web domain. Session cookies stay first-party.
- **Webhooks** go straight to the API, never through the web app.
- **Local development:** GitHub webhooks reach localhost through a [smee.io](https://smee.io) channel. GitHub App OAuth accepts a localhost callback URL.
- **Hosting:** to be decided later (see Session 6). The code stays host-agnostic: config comes from env vars, and nothing is tied to a specific platform.

## Stack

See [`tech-stack.md`](tech-stack.md) for the stack, versions, conventions and exclusions.

## Repository layout

```
backend/              NestJS
  prisma/             schema.prisma, migrations/
  src/
    config/           zod env schema, fail fast on boot
    common/           logger (structured, redacts secrets), guards, pipes
    prisma/           PrismaService
    auth/             GitHub OAuth, sessions, state/CSRF
    github/           App JWT, installation tokens, REST client
    webhooks/         signature verify, dedupe, persist, enqueue
    queue/            job claim, retry/backoff, worker loop
    rules/            rule CRUD + pure matcher
    actions/          label, comment, slack, ai-triage
    dashboard/        read APIs for events, actions, failures
frontend/             Next.js
  pages/              index (login), dashboard, rules, failures
  components/         shared UI pieces
  styles/             globals.css entry, base.css, components/*.css (@apply)
  lib/                api client
docs/                 prd.md, sessions.md, commands.md, tech-stack.md, ai-log.md
CLAUDE.md  AGENTS.md  AI_NOTES.md  README.md  .env.example
```

## Data model (draft)

| Table | Key fields | Purpose |
|---|---|---|
| `users` | github_id, login | Signed-in users |
| `installations` | installation_id, user_id | GitHub App installs |
| `repositories` | repo_id, full_name, installation_id | Connected repos (multi-repo) |
| `webhook_deliveries` | **delivery_id UNIQUE**, event, payload, received_at | Dedupe + audit log |
| `jobs` | delivery_id, status, attempts, next_run_at, last_error | Durable queue |
| `rules` | repo_id, event, conditions (json), actions (json), enabled | User-configured rules |
| `actions` | **UNIQUE(delivery_id, rule_id, type)**, status, result | Idempotent side effects log |

---

## Session 1 — Foundation

**Goal:** a running local skeleton connected to Neon.

- [ ] `git init`, npm workspaces, `backend/` (Nest) and `frontend/` (Next); strip test tooling (Vitest in Nest 12) and spec files from the Nest scaffold
- [ ] `CLAUDE.md`, `AGENTS.md`, `.env.example`
- [ ] Root `.gitignore` written **before the first commit**: `node_modules/`, `.env*` (keep `.env.example`), `.next/`, `dist/`, `out/`, `coverage/`, `*.log`, `.DS_Store`, `.vscode/`, `.idea/`, `*.pem` (GitHub App private key), `*.tsbuildinfo`, `.vercel/`
- [ ] Verify with `git status` that only source, config and docs are staged
- [ ] zod env validation, structured logger with secret redaction
- [ ] Neon setup (project `github-automation-bot`, ID `winter-cloud-00013821`, branch `production`):
  1. `npm i -g neon@latest && neon login`
  2. `neon skills -y`
  3. `neon mcp -y`
  4. `neon link --project-id winter-cloud-00013821 --branch production -y`
  5. `neon config init`
  6. Set `neon.ts` to `import { defineConfig } from "@neon/config/v1"; export default defineConfig({});`
  7. `neon deploy`
  8. Put the connection string (Console → **Connect**) in `backend/.env` as `DATABASE_URL`; never commit or paste it
  9. Review files the CLI created; gitignore any local/credential files before committing
- [ ] Prisma + Neon, first migration with all tables
- [ ] `GET /api/health` (checks DB), Next.js landing page
- [ ] Next.js rewrites `/api/*` → Nest API

**Done when:** running both apps locally, the web page shows the API health status.

## Session 2 — GitHub App and sign-in

**Goal:** a user signs in and connects repositories.

- [ ] Register GitHub App (permissions: issues, pull requests, metadata; events: issues, pull_request, push)
- [ ] OAuth login with `state` validation; signed, httpOnly, secure session cookie
- [ ] Installation callback stores installation + repositories
- [ ] Auth guard on API; protected pages via `getServerSideProps` session check (redirect to login); logout

**Done when:** sign in locally, install the App on a repo, see it listed.

## Session 3 — Webhook ingestion (reliability core)

**Goal:** events are never forged, duplicated, or lost.

- [ ] Raw-body HMAC verification (`X-Hub-Signature-256`, `timingSafeEqual`)
- [ ] Dedupe on `X-GitHub-Delivery` (unique constraint)
- [ ] One transaction: persist delivery + enqueue job, respond `202` fast
- [ ] Worker: claim with `FOR UPDATE SKIP LOCKED`, exponential backoff, dead-letter after N attempts
- [ ] Boot catch-up: list failed deliveries via App API and request redelivery (covers downtime and free-tier sleep)
- [ ] Handle `issues`, `pull_request`, `push`

**Done when:** a forged request is rejected, a redelivered event is ignored, and a killed worker resumes pending jobs.

## Session 4 — Rules and actions

**Goal:** the bot acts on events according to rules.

- [ ] Installation token service (cached until expiry)
- [ ] Rule matcher (pure): event type, title/body keywords, author, labels
- [ ] Actions: add label, post comment, Slack notification
- [ ] Per-action idempotency row; retries skip actions already succeeded
- [ ] Rules CRUD API with zod validation

**Done when:** opening an issue titled "bug …" adds the `bug` label and posts to Slack exactly once.

## Session 5 — Dashboard and observability

**Goal:** the user can see and control everything.

- [ ] Event log with actions taken, live via short polling
- [ ] Rules page: create, edit, enable/disable, delete
- [ ] Failures page: failed/dead jobs with error and attempts, manual retry
- [ ] Repository filter (multi-repo)
- [ ] Request IDs and delivery IDs in every log line

**Done when:** every event and failure from Sessions 3–4 is visible and retryable in the UI.

## Session 6 — AI triage, hosting, deliverables

**Goal:** stretch AI step, a public deployment, and a submission-ready repo.

- [ ] AI triage (Groq or Gemini): summary + suggested label + priority; shown in Slack and dashboard; degrades gracefully on failure
- [ ] Hosting: pick free no-card hosts (decided at this point), deploy both apps, point GitHub App webhook + callback URLs at them
- [ ] Security pass: no secrets in repo, client bundle, or logs; cookie flags; rate limits on public endpoints
- [ ] Final `README.md`, `.env.example`
- [ ] `AI_NOTES.md` condensed from `docs/ai-log.md` (tools, 2–3 decisions, hardest AI wrong turn, next steps)
- [ ] Demo repo + tester instructions
- [ ] Full end-to-end run on live URLs

**Done when:** a fresh reviewer can follow the README and see the full flow work.

---

## Deliverables tracker

| # | Deliverable | Session | Status |
|---|---|---|---|
| 1 | GitHub repo with clear commit history | All | ☐ |
| 2 | Deployed URL, working and reachable | 6 | ☐ |
| 3 | README: what it does, run locally, env vars, deployment | 6 | ☐ |
| 3a | `.env.example` with no real secrets | 1 | ☐ |
| 4 | Test instructions, demo repo, throwaway credentials | 6 | ☐ |
| 5 | AI context files as used (`CLAUDE.md`, `AGENTS.md`) | All | ☐ |
| 6 | `AI_NOTES.md` (~1 page) | 6 | ☐ |

## Requirements coverage

| Spec item | Session |
|---|---|
| Core 1 — public deployment | 6 |
| Core 2 — GitHub sign-in, connect repo | 2 |
| Core 3 — webhook, ≥2 event types, recorded | 3 |
| Core 4 — write back to GitHub | 4 |
| Core 5 — Slack notification | 4 |
| Core 6 — dashboard behind login | 5 |
| Core 7 — README | 6 |
| Stretch 1 — configurable rules UI | 4, 5 |
| Stretch 2 — AI step | 6 |
| Stretch 3 — GitHub App auth | 2, 4 |
| Stretch 4 — multi-repo | 2, 5 |
| Stretch 5 — observability | 3, 5 |
| Quality 1 — forged/replayed requests | 2, 3 |
| Quality 2 — no duplicate actions | 3, 4 |
| Quality 3 — no lost events | 3 |
| Quality 4 — no exposed secrets | 1, 6 |

## Using AI — and what to report

AI tools are used throughout. `AI_NOTES.md` (about one page) must cover:

| Section | What to write |
|---|---|
| Tools and split | AI tools and models used; roughly what the AI did versus what the developer did |
| Key decisions (2–3) | Choices made by the developer (architecture, data model, service choice) and why |
| Hardest AI wrong turn | What the AI got wrong, how it was noticed, how it was fixed. **Most closely read. Be specific and honest.** |
| With more time | Improvements and additions |
| Optional excerpt | One short prompt or transcript excerpt for the trickiest part. No full logs |

Context files (`CLAUDE.md`, `AGENTS.md`) are submitted **exactly as used**. Don't clean them up afterwards to look better.

### Capture as you go

At the end of **every session**, add a short entry to `docs/ai-log.md`:

```
## Session N — <date>
- Tools/models:
- AI did / I did:
- Decisions I made (and why):
- Where the AI was wrong (symptom → how noticed → fix):
- Prompt worth keeping (optional, short):
```

In Session 6, `AI_NOTES.md` is condensed from this log. Likely candidates for the "hardest wrong turn": signature checks on a parsed rather than raw body, cookies failing across domains, and duplicate side effects on retry.

### End-of-session checklist

- [ ] Code committed with clear messages
- [ ] Session checkboxes ticked above
- [ ] `CLAUDE.md` / `AGENTS.md` updated with new commands, modules, conventions
- [ ] `docs/ai-log.md` entry written
- [ ] `.claude/sessions/session-N/` logs complete (summary, issues, root cause, fixes)

## Conventions

- Code comments: short, 20–30 words maximum.
- One module per concern; business logic in services, not controllers.
- Add a package only when the platform can't do it cleanly.
- Commit per logical step with clear messages.
- Log every change, feature, issue, root cause and fix in `.claude/sessions/session-N/` as it happens: dated table rows only.
- **No `git push` without developer approval.** Enforced by an `ask` rule in `.claude/settings.json`; Claude must also request agreement in chat before pushing.
- Never commit `node_modules`, build output, `.env` files, private keys, or editor/OS files. Extend `.gitignore` whenever a new tool adds generated files.
- Update `CLAUDE.md` / `AGENTS.md` and this file's checkboxes at the end of every session.
- Notes for `AI_NOTES.md` go in `docs/ai-log.md` when they happen, rather than being pieced together at the end.
