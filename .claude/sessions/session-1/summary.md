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
| 2026-09-24 | Frontend switched from Next.js to React + Vite + Tailwind v4 + shadcn/ui; Vite `/api` dev proxy | `frontend/*` |
| 2026-09-24 | Docs updated for React + Vite; tech stack split frontend/backend | `docs/tech-stack.md`, `docs/sessions.md`, `docs/commands.md`, `.claude/commands/check-secrets.md` |
| 2026-09-24 | Plan: authentication via Neon Auth (GitHub sign-in, JWT verified by backend via JWKS) | `docs/sessions.md`, `docs/tech-stack.md` |
| 2026-09-24 | Phase 1 plan: authentication with Neon Auth (manual setup steps + build plan) | `docs/phase/phase-1.md` |
| 2026-09-24 | Phase 1 backend: global Neon Auth JWT guard (JWKS, EdDSA, issuer, expiry), `@Public()`, `@CurrentUser()`, `GET /api/me`, public `GET /api/health` | `backend/src/auth/*`, `backend/src/health/*`, `backend/src/config/env.ts`, `backend/.env.example` |
| 2026-09-24 | Phase 1 frontend: Neon Auth client (`@neondatabase/auth`), GitHub sign-in, protected routes (`react-router`), JWT api client, zod env + response parsing, dashboard `/api/me` | `frontend/src/lib/*`, `frontend/src/pages/*`, `frontend/src/components/protected-route.tsx`, `frontend/src/router.tsx`, `frontend/src/styles/components/auth.css`, `frontend/.env.example` |
| 2026-09-24 | Workspace restored after root `package.json` deletion; reinstalled on Node 24; npm `allowScripts` reviewed | `package.json`, `package-lock.json` |
| 2026-09-24 | Prisma 7.10 schema (6 tables, 3 enums), config with direct-host migrations, `init` migration applied to Neon, `db:*` scripts | `backend/prisma/*`, `backend/prisma.config.ts`, `backend/package.json`, `.gitignore` |
