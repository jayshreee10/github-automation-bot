# GitHub Automation Bot

Connect your GitHub repositories, write rules, and let the bot act on them. When an event arrives from GitHub, the bot matches it against your rules and adds labels, posts comments and sends Slack notifications. A dashboard shows every event it received, every action it took, and every failure, with a retry button.

- Web app: https://github-automation-bot-theta.vercel.app
- API health: https://github-automation-bot-xo2h.onrender.com/api/health

## What it does

- Sign in with GitHub through Neon Auth, then install the GitHub App on the repositories you choose.
- Handles `issues`, `pull_request` and `push` webhooks. Signatures are verified against the raw body, redeliveries are deduplicated, and each delivery is stored with its job in one transaction.
- Rules match on event type, title and body keywords, author, labels and branch. Actions are add label, post comment, and notify Slack.
- Actions run at most once per delivery, rule and action type, so a retry or a GitHub redelivery never doubles up. A comment posted just before a crash is recovered on the next attempt instead of being posted twice.
- Jobs live in Postgres, claimed with `FOR UPDATE SKIP LOCKED`, retried with exponential backoff, and dead-lettered after repeated failures. On boot the app asks GitHub to redeliver anything it missed while asleep, which matters on a free host that spins down.
- Dashboard: 24 hour stats, live event log with the actions taken, rules editor, failures page with manual retry, and a per-repository filter.
- Slack is configured per user in Settings. The webhook URL is encrypted at rest with AES-256-GCM, bound to the user id.

The AI triage step from the brief is not built. See `AI_NOTES.md`.

## Stack

React 19 and Vite on the frontend, NestJS on the backend, Neon Postgres with Prisma, Neon Auth (managed Better Auth) for sign-in, a GitHub App for repository access, Slack Incoming Webhooks for notifications. Full version list and conventions: `docs/tech-stack.md`.

## Run it locally

Prerequisites: Node 24 (`nvm use`), a Neon project, a GitHub App, and a Slack Incoming Webhook if you want notifications.

```sh
git clone https://github.com/jayshreee10/github-automation-bot.git
cd github-automation-bot
nvm use
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Fill in both env files (see the table below), then:

```sh
npm run db:migrate -w backend   # apply migrations to your Neon branch
npm start                       # backend on :4000, frontend on :5173
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the backend, so there is no CORS setup and no API URL in the frontend config.

To receive real GitHub webhooks on localhost, create a [smee.io](https://smee.io) channel, set it as the GitHub App's webhook URL, put it in `SMEE_URL`, and run:

```sh
npm run webhooks -w backend
```

### GitHub App settings

| Setting | Value |
| --- | --- |
| Repository permissions | Issues: read and write · Pull requests: read and write · Metadata: read |
| Subscribe to events | Issues, Pull request, Push |
| Webhook URL | your smee channel locally, `https://github-automation-bot-xo2h.onrender.com/api/webhooks/github` in production |
| Webhook secret | the same value as `GITHUB_WEBHOOK_SECRET` |
| Setup URL | `http://localhost:5173/github/setup` locally, `https://github-automation-bot-theta.vercel.app/github/setup` in production |

Neon Auth needs GitHub as an OAuth provider and your app origin in its trusted domains.

## Environment variables

`backend/.env` (set in the Render dashboard in production):

| Variable | Secret | What it is |
| --- | --- | --- |
| `NODE_ENV` | no | `development` or `production` |
| `PORT` | no | Local port, default 4000. The host assigns it in production |
| `DATABASE_URL` | yes | Pooled Neon connection string, keep `sslmode=require` |
| `NEON_AUTH_URL` | no | Neon Console → Auth → Auth URL |
| `GITHUB_APP_ID` | no | GitHub App id |
| `GITHUB_APP_SLUG` | no | GitHub App slug, used to build install links |
| `GITHUB_APP_PRIVATE_KEY` | yes | The App's `.pem`, base64 encoded on one line |
| `GITHUB_WEBHOOK_SECRET` | yes | `openssl rand -hex 32`, same value in the App settings |
| `SETTINGS_ENCRYPTION_KEY` | yes | `openssl rand -base64 32`, encrypts saved Slack webhook URLs |
| `SMEE_URL` | local only | smee.io channel for local webhook forwarding, unset in production |

`frontend/.env.local` (set in the Vercel project in production). Both are public and end up in the browser bundle, so never put a secret in a `VITE_*` variable:

| Variable | What it is |
| --- | --- |
| `VITE_NEON_AUTH_URL` | Neon Console → Auth → Auth URL |
| `VITE_GITHUB_APP_SLUG` | `github.com/apps/<slug>` of your App |

`backend/.env.example` and `frontend/.env.example` list all of these with no real values.

## How to test it

Full product test cases are in `docs/test-cases.md`. The short version, against a throwaway repository you own:

1. Sign in with GitHub, then install the App on that repository.
2. In Settings → Slack, paste an Incoming Webhook URL and send the test message.
3. Create a rule: trigger "Issue opened", title contains `bug`, then switch on Add label (`bug`), Add comment, and Notify Slack.
4. Trigger it:

   ```sh
   gh issue create -R <owner>/<repo> --title "bug: login fails" --body "steps inside"
   gh issue view <n> -R <owner>/<repo> --json labels,comments
   ```

   The label and the comment appear on the issue, Slack gets one message, and the event shows up on the dashboard with its actions.
5. Confirm no duplicates: in GitHub → your App → Advanced, redeliver that same delivery. Nothing is added a second time, and the dashboard shows the delivery as already handled.
6. Confirm forged requests are rejected:

   ```sh
   curl -i -X POST https://github-automation-bot-xo2h.onrender.com/api/webhooks/github \
     -H 'Content-Type: application/json' \
     -H 'X-GitHub-Event: issues' -H 'X-GitHub-Delivery: test-1' \
     -d '{}'
   ```

   Returns `401`, and nothing is stored.
7. Break something on purpose: in Settings, save a `https://hooks.slack.com/services/...` URL that Slack no longer accepts, trigger the rule, and the Slack action lands on the Failures page while the label and comment still succeed. Fix the URL, press Retry, and only the failed action runs again.

Clean up with `gh issue close <n> -R <owner>/<repo>`.

## Tests

```sh
npm test          # both suites
npm test -w backend
npm test -w frontend
npm run lint
npm run build
```

Vitest in both workspaces, 81 spec files. Prisma, the GitHub API, Slack and JWKS are mocked, so no database or network is needed. The tests cover the failure paths: forged and duplicate webhooks, worker retries, dead-lettering, crash recovery on comments, rule matching, ownership checks, and the dashboard pages.

Conventions, module layout and the rules for changing this code are in `AGENTS.md`.

## Deployment

| Piece | Host | Notes |
| --- | --- | --- |
| Backend | Render web service, free plan, at `github-automation-bot-xo2h.onrender.com` | Build `npm ci --include=dev && npm run build -w backend`, start `npm run start:prod -w backend`, health check `/api/health` |
| Frontend | Vercel, free plan, at `github-automation-bot-theta.vercel.app` | Built from the repo root by `vercel.json`, output `frontend/dist` |
| Database | Neon Postgres | Migrations with `npm run db:deploy -w backend` |

`vercel.json` rewrites `/api/*` to the Render service, so the browser talks to one origin and the backend needs no CORS configuration. GitHub webhooks go straight to the Render URL, never through Vercel. Swagger (`/api/docs`) is development only.

Free-tier caveat: the Render service sleeps after about 15 minutes idle, so the first request after that is slow and a webhook arriving at that moment times out on GitHub's side. The boot catch-up asks GitHub to redeliver those, so events are not lost, they arrive late.

The deployment plan, including the tagged release pipeline, is in `docs/phase/phase-deployment.md`.
