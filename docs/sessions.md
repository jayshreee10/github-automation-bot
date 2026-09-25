# Build Plan — Sessions

How this project is built, one session at a time. Each session ends with working, committed code and an updated `CLAUDE.md` / `AGENTS.md`.

Source spec: [`prd.md`](prd.md)
Workflow commands: [`commands.md`](commands.md)
Tech stack: [`tech-stack.md`](tech-stack.md)
Phase plans: [`phase/`](phase/) — [phase 1: authentication](phase/phase-1.md) · [phase 2: GitHub App and repos](phase/phase-2.md) · [phase 3: webhooks and queue](phase/phase-3.md) · [phase 4: rules and actions](phase/phase-4.md) · [phase 5: dashboard and observability](phase/phase-5.md)

---

## Architecture

```
 GitHub ──webhook──▶ NestJS API ──▶ Neon Postgres
   ▲                    │   ▲                  (events, jobs, rules, actions,
   │  label / comment   │   │ /api/* + JWT      neon_auth users)
   └────────────────────┘   │
                            │
 Browser ──▶ React SPA ─────┘
               │
               └──sign in with GitHub──▶ Neon Auth (managed Better Auth) ──▶ JWT

 NestJS worker ──▶ Slack Incoming Webhook  (Groq/Gemini AI: later, Session 7)
```

- **React + Vite (`frontend/`)** — single-page app: sign-in page, dashboard, rules UI.
- **NestJS (`backend/`)** — JWT verification, webhooks, job queue worker, GitHub/Slack calls (AI calls come later, Session 7). Runs as a long-lived process, so the worker lives in-process.
- **Authentication — Neon Auth:** users sign in with GitHub through Neon Auth (managed Better Auth). The SPA sends the Neon Auth JWT as `Authorization: Bearer` on every `/api/*` call; Nest verifies its signature, issuer, audience and expiry against Neon Auth's JWKS. Users live in the `neon_auth` schema of our database.
- **Repo access — GitHub App:** separate from sign-in. The App gives webhooks, installation tokens and per-repo permissions.
- **API calls:** the SPA uses relative `/api/*` URLs. In dev, Vite proxies them to Nest; production routing is decided in Session 6.
- **Webhooks** go straight to the API, never through the web app.
- **Local development:** GitHub webhooks reach localhost through a [smee.io](https://smee.io) channel. Neon Auth and GitHub App callbacks accept localhost URLs.
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
    auth/             Neon Auth JWT guard (JWKS), current-user decorator
    github/           App JWT, installation tokens, REST client
    webhooks/         signature verify, dedupe, persist, enqueue
    queue/            job claim, retry/backoff, worker loop
    rules/            rule CRUD + pure matcher
    actions/          label, comment, slack (ai-triage later, Session 7)
    dashboard/        read APIs for events, actions, failures
frontend/             React + Vite
  src/
    pages/            login, dashboard, rules, failures
    components/       app components
    components/ui/    shadcn/ui (generated)
    lib/              Neon Auth client, api client (attaches JWT), utils
    styles/           globals.css entry + shadcn theme, components/*.css (@apply)
docs/                 prd.md, sessions.md, commands.md, tech-stack.md, ai-log.md, phase/
CLAUDE.md  AGENTS.md  AI_NOTES.md  README.md  .env.example
```

## Data model (draft)

| Table | Key fields | Purpose |
|---|---|---|
| `neon_auth.*` | managed by Neon Auth | Users, accounts (GitHub id), sessions — not in our Prisma migrations |
| `installations` | installation_id, user_id (Neon Auth user id), github_account_id | GitHub App installs |
| `repositories` | repo_id, full_name, installation_id | Connected repos (multi-repo) |
| `webhook_deliveries` | **delivery_id UNIQUE**, event, payload, received_at | Dedupe + audit log |
| `jobs` | delivery_id, status, attempts, next_run_at, last_error | Durable queue |
| `rules` | repo_id, event, conditions (json), actions (json), enabled | User-configured rules |
| `actions` | **UNIQUE(delivery_id, rule_id, type)**, status, result | Idempotent side effects log |

## Test repository

End-to-end checks run against **[jayshreee10/test-bot](https://github.com/jayshreee10/test-bot)** with the `gh` CLI, once a session's implementation is done. The App must be installed on it (phase 2 flow).

| Trigger | Command |
|---|---|
| Open an issue | `gh issue create -R jayshreee10/test-bot --title "bug: <text>" --body "<text>"` |
| Close / reopen an issue | `gh issue close <n> -R jayshreee10/test-bot` · `gh issue reopen <n> -R jayshreee10/test-bot` |
| Push a commit | Clone into the scratchpad, commit, `git push` to a test branch |
| Open a PR | `gh pr create -R jayshreee10/test-bot --head <test-branch> --title "<text>" --body "<text>"` |
| Check the bot's result | `gh issue view <n> -R jayshreee10/test-bot --json labels,comments` |

- Only this repo is used for test traffic; never test against real project repos.
- Pushes to `test-bot` are test fixtures only. The "no `git push` without approval" rule for this project's repo still applies.
- Clean up with `gh issue close` / `gh pr close --delete-branch` after each run.

---

## Session 1 — Foundation

**Goal:** a running local skeleton connected to Neon.

- [ ] `git init`, npm workspaces, `backend/` (Nest) and `frontend/` (React + Vite); strip test tooling (Vitest in Nest 12) and spec files from the Nest scaffold
- [ ] `CLAUDE.md`, `AGENTS.md`, `.env.example`
- [ ] Root `.gitignore` written **before the first commit**: `node_modules/`, `.env*` (keep `.env.example`), `dist/`, `out/`, `coverage/`, `*.log`, `.DS_Store`, `.vscode/`, `.idea/`, `*.pem` (GitHub App private key), `*.tsbuildinfo`, `.vercel/`
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
- [ ] Switch frontend to React + Vite + Tailwind + shadcn/ui
- [ ] `GET /api/health` (checks DB), landing page shows health status
- [ ] Vite dev proxy `/api/*` → Nest API

**Done when:** running both apps locally, the web page shows the API health status.

## Session 2 — Neon Auth sign-in and GitHub App

**Goal:** a user signs in and connects repositories.

- [ ] Register GitHub App (permissions: issues, pull requests, metadata; events: issues, pull_request, push)
- [ ] Enable Neon Auth on the project; add GitHub as OAuth provider with our own client ID/secret (try the GitHub App's credentials so one GitHub registration serves both)
- [ ] Frontend: Neon Auth client, "Sign in with GitHub", session state, sign out
- [ ] Frontend: client-side router with protected routes (redirect to login when signed out)
- [ ] Frontend: api client attaches the JWT as a Bearer token and refreshes it on expiry (15 min tokens)
- [ ] Backend: global auth guard verifying the JWT via Neon Auth JWKS (signature, `iss`, `aud`, `exp`); `@Public()` for health and webhooks; `@CurrentUser()`; `GET /api/me`
- [ ] Installation callback: verify the installation's GitHub account matches the signed-in user's GitHub id (from `neon_auth`), then store installation + repositories

**Done when:** sign in with GitHub via Neon Auth, install the App on a repo, see it listed; `/api/*` rejects missing or forged tokens.

## Session 3 — Webhook ingestion (reliability core)

**Goal:** events are never forged, duplicated, or lost.

- [ ] Raw-body HMAC verification (`X-Hub-Signature-256`, `timingSafeEqual`)
- [ ] Dedupe on `X-GitHub-Delivery` (unique constraint)
- [ ] One transaction: persist delivery + enqueue job, respond `202` fast
- [ ] Worker: claim with `FOR UPDATE SKIP LOCKED`, exponential backoff, dead-letter after N attempts
- [ ] Boot catch-up: list failed deliveries via App API and request redelivery (covers downtime and free-tier sleep)
- [ ] Handle `issues`, `pull_request`, `push`

**Done when:** a forged request is rejected, a redelivered event is ignored, and a killed worker resumes pending jobs. Verified with `gh` against the [test repository](#test-repository).

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

## Session 6 — Hosting and deliverables

**Goal:** a public deployment and a submission-ready repo.

- [ ] Hosting: pick free no-card hosts (decided at this point), deploy both apps, point GitHub App webhook + callback URLs at them
- [ ] Security pass: no secrets in repo, client bundle, or logs; JWT verification checks; rate limits on public endpoints
- [ ] Final `README.md`, `.env.example`
- [ ] `AI_NOTES.md` condensed from `docs/ai-log.md` (tools, 2–3 decisions, hardest AI wrong turn, next steps)
- [ ] Demo repo (`jayshreee10/test-bot`, see [Test repository](#test-repository)) + tester instructions
- [ ] Full end-to-end run on live URLs

**Done when:** a fresh reviewer can follow the README and see the full flow work.

## Session 7 — AI triage (later)

**Deferred:** not built for now; picked up after the core flow is deployed. The app must work fully without it.

- [ ] AI triage (Groq or Gemini): summary + suggested label + priority; shown in Slack and dashboard; degrades gracefully on failure
- [ ] Env var for the AI key (optional; feature off when unset)
- [ ] Redeploy and re-run the end-to-end check

**Done when:** a new issue gets a summary, label suggestion and priority in Slack and the dashboard, and an AI outage never blocks other actions.

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
| Stretch 2 — AI step | 7 (later) |
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

In Session 6, `AI_NOTES.md` is condensed from this log. Likely candidates for the "hardest wrong turn": signature checks on a parsed rather than raw body, JWT verification gaps (issuer/audience/expiry), and duplicate side effects on retry.

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
