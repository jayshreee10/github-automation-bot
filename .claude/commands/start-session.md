---
description: Start a build session from docs/sessions.md
argument-hint: <session-number>
---

Start Session $1 of the build plan.

1. Read `docs/sessions.md` (Session $1 section, conventions, data model), `CLAUDE.md`, `AGENTS.md`, and the latest entry in `docs/ai-log.md` if it exists.
2. Check that earlier sessions are complete. If any earlier checkbox is unticked, list it and ask whether to continue.
3. Run `git status` and report uncommitted changes.
4. Present a short step-by-step plan for Session $1 only: files to create or change, packages to add (with a one-line reason each), and the order of work.
5. Wait for approval before writing any code.

Rules while working: log every change, new feature, issue, root cause and fix as it happens in `.claude/sessions/session-$1/` (`summary.md`, `issues.md`, `root-cause.md`, `fixes.md`) — dated table rows only, no extra description. Stay inside Session $1 scope, add no unlisted packages, keep code comments to 20–30 words maximum, and commit after each logical step once the user agrees.
