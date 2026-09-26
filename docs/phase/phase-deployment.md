# Phase Deployment

Take the working local app to a public URL. Backend on Render, frontend on Vercel, one tag to ship both.

Sources: [`sessions.md`](../sessions.md) (Session 6) · [`tech-stack.md`](../tech-stack.md) · [`prd.md`](../prd.md)

---

## 1. Hosts

| App | Host | Free tier notes |
| --- | --- | --- |
| Backend (`backend/`, NestJS) | Render web service | No card. Spins down after ~15 min idle; first request after that is slow. |
| Frontend (`frontend/`, React + Vite) | Vercel | No card. Static build, served from the CDN. |
| Database | Neon (already set up in Session 1) | Unchanged by this phase. |

## 2. CLI tools

Both hosts ship an official CLI, and both are assumed already installed and logged in.

| Host | Install | Version used | Auth |
| --- | --- | --- | --- |
| Render | `brew install render` | 2.22.0 | `render login` (browser), `RENDER_API_KEY` in CI |
| Vercel | `npm i -g vercel` | 56.3.2 | `vercel login`, `VERCEL_TOKEN` in CI |

## 3. Production topology

```
 Browser ──▶ Vercel (React SPA)
               │  /api/* rewritten by Vercel
               ▼
 GitHub ──webhook──▶ Render (NestJS) ──▶ Neon Postgres
                        │
                        └──▶ Slack Incoming Webhook
```

- The SPA keeps calling relative `/api/*`. Vercel rewrites those to the Render URL, so the browser sees one origin and the backend needs no CORS config.
- GitHub webhooks go straight to the Render URL, never through Vercel.
- Nothing in the code learns the host names: both come from config.

## 4. Division of work

| Who | Does what |
| --- | --- |
| Human | Anything that only exists behind a login on a website: creating the Render service's secret env vars, creating API tokens, setting GitHub Actions secrets, updating the GitHub App URLs, adding the production origin to Neon Auth. |
| AI agent | All code and config changes in the repo, and every CLI call: creating the Render service, setting non-secret env vars, linking the Vercel project, first manual deploys, verification. |

The agent never sees or writes a secret value. Secrets go from the human straight into a dashboard or `gh secret set`.

---

## 5. Human tasks

### 5.1 Render

1. Connect the GitHub account to Render once: Render Dashboard → **New** → any service → **Connect GitHub**, and grant access to this repository. Without this, `render services create --repo` cannot read the repo.
2. After the agent creates the service, open it → **Environment** and add the secret values:
   - `DATABASE_URL`: the pooled Neon connection string
   - `GITHUB_APP_PRIVATE_KEY`: one-line base64 of the `.pem`
   - `GITHUB_WEBHOOK_SECRET`: same value as in the GitHub App
   - `SLACK_WEBHOOK_URL`: the Incoming Webhook

   `DATABASE_URL` is needed at build time too: `prisma.config.ts` reads it when `prisma generate` runs. Until it is set, the build fails, not only the boot.
3. Account Settings → **API Keys** → create a key. Keep it for step 5.4.
4. Note the service URL (`https://<name>.onrender.com`) and give it to the agent; it is not a secret.

### 5.2 Vercel

1. Project Settings → **Environment Variables** → confirm the two `VITE_*` values the agent added are correct for Production. Both are public, neither is a secret.
2. Account Settings → **Tokens** → create a token. Keep it for step 5.4.
3. Note the production domain (`https://<project>.vercel.app`).

### 5.3 GitHub App and Neon Auth

Do this after both URLs exist.

| Setting | Where | New value |
| --- | --- | --- |
| Webhook URL | GitHub App settings | `https://<render-app>/api/webhooks/github` |
| Homepage URL | GitHub App settings | `https://<vercel-app>` |
| Setup URL | GitHub App settings | `https://<vercel-app>/github/setup` |
| Callback URL | GitHub App settings | `https://<vercel-app>` |
| OAuth callback | Neon Console → Auth → GitHub provider | as the Neon Auth page states for the production origin |
| Trusted domains | Neon Console → Auth | add `https://<vercel-app>` |

Callback URLs and Neon trusted domains accept several values, so keep the localhost entries alongside the new ones. The Webhook URL and the Setup URL hold **one value each**. Once they point at production, the smee channel stops receiving events and the local setup redirect stops working. Two ways to handle it:

- Accept it: switch the two URLs back temporarily when developing locally.
- Or create a second GitHub App for local development with its own `GITHUB_APP_*` values in `backend/.env`.

Local and production also share one Neon database unless you make a Neon branch for production. With one database, a locally running backend's worker and catch-up would take production jobs, so stop the local backend while production is live, or give production its own branch.

### 5.4 GitHub Actions secrets

Run these yourself so the values never pass through the agent:

```sh
gh secret set RENDER_API_KEY
gh secret set RENDER_SERVICE_ID      # srv-xxxxxxxx, from `render services`
gh secret set VERCEL_TOKEN
gh secret set VERCEL_ORG_ID          # from .vercel/project.json after linking
gh secret set VERCEL_PROJECT_ID      # from .vercel/project.json after linking
gh secret set DATABASE_URL           # pooled Neon URL, used by prisma migrate deploy
```

---

## 6. Agent tasks: code changes

| # | File | Change |
| --- | --- | --- |
| C1 | `vercel.json` (new, repo root) | Build the frontend from the workspace root and rewrite `/api/*` to Render. |
| C2 | `scripts/deploy.sh` (new) | Tag-and-push release script. See §8. |
| C3 | `.github/workflows/deploy.yml` (new) | Tag-triggered pipeline: migrate, then deploy both apps. See §9. |
| C4 | `backend/src/core/config/env.ts` | None. `SLACK_WEBHOOK_URL` and optional `SMEE_URL` are already there, and `PORT` already comes from env, which is how Render assigns the port. |
| C5 | `backend/.env.example`, `frontend/.env.example` | Both exist and list every variable. Add one line to each saying where production sets them (Render, Vercel), and mark `SMEE_URL` as unset in production. |
| C6 | `package.json` (root) | Add `"deploy": "bash scripts/deploy.sh"`. |
| C7 | `README.md` | Deployment section: the two hosts, the tag flow, the env var table, how to roll back. |
| C8 | `docs/sessions.md` | Tick Session 6's hosting boxes, replace "to be decided later" in Architecture with Render + Vercel, and link this document. |

Pre-deploy check: the `FAIL_FOR_TESTING` throw in `backend/src/modules/queue/worker.service.ts` must stay commented out. It is today.

`frontend/src/lib/api.ts` stays as it is. The relative `/api` prefix plus the Vercel rewrite is what removes the need for a `VITE_API_URL` and for CORS.

### C1: `vercel.json`

```json
{
  "framework": "vite",
  "installCommand": "npm ci",
  "buildCommand": "npm run build -w frontend",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<render-app>.onrender.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The Vercel project's Root Directory stays at the repository root so `npm ci` installs the workspace lockfile. The catch-all gives deep links such as `/rules/:id` and `/github/setup` their `index.html` fallback. Real files in `dist/` are served before rewrites, so assets are unaffected, and `/api` is listed first so it wins.

---

## 7. Agent tasks: CLI

### 7.1 Create the Render service

```sh
render services create \
  --name github-automation-bot-api \
  --type web_service \
  --runtime node \
  --plan free \
  --region singapore \
  --repo https://github.com/<owner>/github-automation-bot \
  --branch main \
  --build-command "npm ci --include=dev && npm run build -w backend" \
  --start-command "npm run start:prod -w backend" \
  --health-check-path /api/health \
  --env-var NODE_ENV=production \
  --env-var NODE_VERSION=24 \
  --env-var NEON_AUTH_URL=<public auth url> \
  --env-var GITHUB_APP_ID=<id> \
  --env-var GITHUB_APP_SLUG=<slug> \
  --output json --confirm
```

Then turn the repo-push trigger off, because tags drive deploys:

```sh
render services update <srv-id> --auto-deploy=false --confirm
```

Render provides `PORT` itself; do not set it. `--include=dev` matters: with `NODE_ENV=production`, a plain `npm ci` skips devDependencies, and the Nest CLI, Prisma and TypeScript are all devDependencies. `npm run build -w backend` runs `prisma generate && nest build` and outputs `backend/dist/main.js`, which is what `start:prod` runs.

The four secret variables are the human's step 5.1.2. The first build fails until they exist, because `prisma generate` needs `DATABASE_URL`. That is expected: redeploy after 5.1.2.

### 7.2 Link and configure Vercel

```sh
vercel link --yes --project github-automation-bot
vercel env add VITE_NEON_AUTH_URL production
vercel env add VITE_GITHUB_APP_SLUG production
```

Both values are public. `vercel link` writes `.vercel/project.json`, which holds the org and project ids the human needs for step 5.4. `.vercel/` is already gitignored.

### 7.3 First deploys, by hand

```sh
npm run db:deploy -w backend                    # migrations against Neon
render deploys create <srv-id> --wait --confirm  # backend
vercel deploy --prod                            # frontend
```

### 7.4 Verify

| # | Check | Expected |
| --- | --- | --- |
| 1 | `curl https://<render-app>/api/health` | `200` with the DB reachable |
| 2 | `curl https://<render-app>/api/me` | `401`, no token |
| 3 | `curl https://<render-app>/api/docs` | `404`, Swagger is off in production |
| 4 | Open `https://<vercel-app>` signed out | Redirected to `/login` |
| 5 | Sign in with GitHub, install the App on `jayshreee10/test-bot` | Repo listed on the dashboard |
| 6 | `gh issue create -R jayshreee10/test-bot --title "bug: deploy check"` | Label added, Slack message posted once, event on the dashboard |
| 7 | Redeliver that delivery from the App's **Advanced** tab | No second label, no second Slack message |
| 8 | Open an issue while the service is asleep, wait for it to wake | Boot catch-up requests the redelivery and the event lands |
| 9 | `curl -X POST https://<render-app>/api/webhooks/github -d '{}'` | `401`, bad signature |
| 10 | Browser devtools → Network on the dashboard | `/api/*` calls are same-origin, no CORS preflight |
| 11 | Hard refresh on `https://<vercel-app>/rules/new` | The page loads, not a Vercel 404 |

---

## 8. `scripts/deploy.sh`

One job: put a tag on the current commit and push it. The pipeline does the rest.

Rules it enforces:

1. Working tree is clean.
2. Current branch is `main` and up to date with `origin/main`.
3. Tag name is `v<major>.<minor>.<patch>`, taken from the first argument, or the previous tag's patch plus one when no argument is given.
4. The tag does not already exist locally or on the remote.
5. Prints the tag and the commit, then asks for confirmation before pushing.

```sh
scripts/deploy.sh          # v0.1.3 → v0.1.4
scripts/deploy.sh v1.0.0   # explicit
```

Pushing the tag is the only write to the remote, and the script asks first. Render deploys a branch rather than a tag, so the pipeline passes the tagged commit explicitly with `--commit`; that keeps the two hosts on the same commit even if `main` has moved on.

## 9. `.github/workflows/deploy.yml`

Trigger: `push` on tags matching `v*`. Plus `workflow_dispatch` so a deploy can be re-run without a new tag.

| Job | Needs | Steps |
| --- | --- | --- |
| `verify` | nothing | checkout, Node 24 via `.nvmrc`, `npm ci`, `npm run lint`, `npm test`, `npm run build` |
| `migrate` | `verify` | checkout, Node 24 via `.nvmrc`, `npm ci`, `npm run db:deploy -w backend` with `DATABASE_URL` |
| `backend` | `migrate` | install the Render CLI, `render deploys create $RENDER_SERVICE_ID --commit $GITHUB_SHA --wait --confirm -o json` with `RENDER_API_KEY` |
| `frontend` | `migrate` | `npm i -g vercel`, `vercel pull --yes --environment=production`, `vercel build --prod`, `vercel deploy --prebuilt --prod`, all with `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |

Notes:

- `verify` covers Session 6's "`npm test` runs before every deploy". The generated Prisma client is gitignored, so tests and build need `prisma generate`, which needs a `DATABASE_URL` value. It never connects, so `verify` sets a placeholder (`postgresql://u:p@localhost/db`) rather than the secret.
- `backend` and `frontend` run in parallel; both wait for migrations, so the schema is never behind the code.
- Migrations must stay backward compatible for the few seconds when the old instance is still serving.
- On Ubuntu runners the Render CLI comes from its GitHub release binary, not Homebrew. Check the install command in the `render-oss/cli` README when writing the workflow. A deploy hook URL called with `curl` is the fallback if the CLI is awkward in CI.
- Rollback: re-run the workflow from an older tag, or `render deploys create <srv-id> --commit <old-sha>` and `vercel rollback` for the frontend.

## 10. Environment variables

| Variable | Backend (Render) | Frontend (Vercel) | CI | Secret |
| --- | --- | --- | --- | --- |
| `NODE_ENV=production` | ✓ | no | no | no |
| `NODE_VERSION=24` | ✓ | no | no | no |
| `PORT` | set by Render | no | no | no |
| `DATABASE_URL` | ✓ | no | ✓ (migrations) | yes |
| `NEON_AUTH_URL` | ✓ | no | no | no |
| `GITHUB_APP_ID` | ✓ | no | no | no |
| `GITHUB_APP_SLUG` | ✓ | no | no | no |
| `GITHUB_APP_PRIVATE_KEY` | ✓ | no | no | yes |
| `GITHUB_WEBHOOK_SECRET` | ✓ | no | no | yes |
| `SLACK_WEBHOOK_URL` | ✓ | no | no | yes |
| `SMEE_URL` | not set | no | no | local only |
| `VITE_NEON_AUTH_URL` | no | ✓ | no | no |
| `VITE_GITHUB_APP_SLUG` | no | ✓ | no | no |
| `RENDER_API_KEY`, `RENDER_SERVICE_ID` | no | no | ✓ | yes |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | no | no | ✓ | yes |

## 11. Free-tier consequences

| Thing | Effect | What covers it |
| --- | --- | --- |
| Render spins the service down when idle | GitHub gives up after 10 s, before the cold start ends, so the waking delivery fails | Catch-up (`catch-up.service.ts`) runs on boot and every 15 min while awake, and asks GitHub to redeliver missed deliveries from the last 3 days |
| Cold start of roughly 30-50 s | The first dashboard load after idle is slow | Nothing; it is a known cost of the free plan |
| The in-process worker sleeps with the service | Queued jobs wait until the next request wakes it | Jobs are durable in Postgres and the worker resumes on boot |
| Neon scale-to-zero | First query after idle is slow | Prisma retries the connection |

## 12. Order of execution

1. Agent: C1-C3, C5, C6, commit (with approval).
2. Human: 5.1.1 (connect GitHub to Render).
3. Agent: 7.1 create the service (its first build fails, as expected), 7.2 link Vercel.
4. Human: 5.1.2 secrets, 5.1.3 API key, 5.2 token, note both URLs.
5. Agent: fill the real Render URL into `vercel.json`, commit.
6. Human: 5.3 GitHub App and Neon Auth URLs, 5.4 Actions secrets.
7. Agent: 7.3 first manual deploys, then 7.4 verification.
8. Human: run `scripts/deploy.sh` once to prove the tag path works end to end.
9. Agent: C7, C8, the README and the session doc.

## Out of scope here

Other Session 6 items are separate work: the security pass (rate limits on public endpoints, a secrets audit of the bundle and logs), `AI_NOTES.md` and tester instructions.

## References

- [Render CLI](https://render.com/docs/cli) · [free instance types](https://render.com/docs/free)
- [Vercel CLI](https://vercel.com/docs/cli) · [monorepo projects](https://vercel.com/docs/monorepos) · [rewrites](https://vercel.com/docs/project-configuration#rewrites)
- [Prisma migrate in CI](https://www.prisma.io/docs/orm/prisma-migrate/workflows/production-and-testing)
