# Tech Stack

## Shared

| Concern | Choice |
|---|---|
| Runtime | Node.js 24 LTS (`.nvmrc`); supported: 22.12+ or 24+ |
| Monorepo | npm workspaces: `backend/`, `frontend/` (no Turborepo) |
| Hosting | Decided later — free tier, no card |

---

## Frontend (`frontend/`)

### Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (Pages Router) |
| UI | React |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| API access | `/api/*` rewrites to the backend (same-origin cookies) |
| Linting | ESLint (`eslint-config-next`) |

### Versions

| Package | Version |
|---|---|
| `next` | 16 |
| `react`, `react-dom` | 19 |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3 |
| `typescript` | 5 |
| `eslint`, `eslint-config-next` | 9, 16 |

### Conventions

- No inline Tailwind utilities in JSX. Define semantic classes with `@apply` in `styles/` and use those names.
  - `styles/globals.css` — single entry, imported only in `pages/_app.tsx`
  - `styles/base.css` — element defaults
  - `styles/components/*.css` — one file per UI area, imported in `globals.css`
- Only `NEXT_PUBLIC_*` env vars reach the browser; never put secrets in them.

### Excluded

UI component libraries, state-management libraries, inline Tailwind utilities in JSX.

---

## Backend (`backend/`)

### Stack

| Concern | Choice |
|---|---|
| Framework | NestJS (ESM) |
| Language | TypeScript |
| Database | Neon Postgres |
| ORM / migrations | Prisma |
| Validation | zod (env + request bodies) |
| Scheduling | `@nestjs/schedule` for the worker poll loop |
| GitHub | GitHub App — built-in `fetch` + `crypto` for JWT |
| Notifications | Slack Incoming Webhook |
| AI | Groq or Gemini free tier via `fetch` |
| Local webhooks | [smee.io](https://smee.io) channel to localhost |
| Linting / format | `oxlint`, `prettier` |

### Versions

| Package | Version |
|---|---|
| `@nestjs/*` | 12 |
| `typescript` | 6 |
| `zod` | 4 |
| `prisma`, `@prisma/client` | 7.10.0 (pinned stable; npm `latest` is an 8.0 RC) |
| `oxlint`, `prettier` | 1, 3 |

### Conventions

- Env loaded with Node's built-in `process.loadEnvFile()`; validated once at boot, fails fast listing names only.
- Logging: Nest `ConsoleLogger` subclass; JSON in production, secrets redacted.
- Global route prefix `/api`.

### Excluded

Automated tests (Jest / Vitest), Redis/BullMQ, Docker, websockets, Octokit, `dotenv`.
