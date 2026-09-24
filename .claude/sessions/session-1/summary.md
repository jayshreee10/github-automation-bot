# Session 1 — Summary

| Date | Change / Feature | Files |
|---|---|---|
| 2026-09-24 | Repo initialized; `.gitignore` before first commit | `.gitignore` |
| 2026-09-24 | npm workspaces root | `package.json` |
| 2026-09-24 | NestJS 12 backend scaffold; Vitest, Mau, spec files removed | `backend/*` |
| 2026-09-24 | Next.js 16 frontend scaffold, Pages Router | `frontend/*` |
| 2026-09-24 | Layout changed to top-level `frontend/` and `backend/` | `package.json`, `docs/sessions.md` |
| 2026-09-24 | Zod env validation, fail fast (names only), built-in `.env` loading | `backend/src/config/*`, `backend/.env.example` |
| 2026-09-24 | Logger: JSON in prod, secret redaction on every message | `backend/src/common/logger/*`, `backend/src/main.ts` |
| 2026-09-24 | Tailwind v4; styles in `styles/` via `@apply`, no inline utilities | `frontend/styles/*`, `frontend/postcss.config.mjs`, `frontend/pages/*` |
