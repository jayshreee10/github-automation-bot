---
description: Close a session with the end-of-session checklist
argument-hint: <session-number>
---

Close Session $1.

1. Verify each Session $1 task against the code. Tick only tasks that are really done; list any that are not.
2. Check the "Done when" condition and tell the user how to confirm it manually.
3. Update `CLAUDE.md` and `AGENTS.md` with new commands, modules, env vars and conventions from this session. Keep them short and organized; remove anything outdated.
4. Check `.claude/sessions/session-$1/`: every change and feature is in `summary.md`; every issue in `issues.md` has a `root-cause.md` and `fixes.md` row or is still marked `open`. Add missing rows.
5. Update the Deliverables tracker in `docs/sessions.md` if anything changed.
6. Draft a `docs/ai-log.md` entry using the template in `docs/sessions.md`. Ask the user to fill in or confirm the "Where the AI was wrong" line. Never invent it.
7. Run `/check-secrets`, then show `git status` and propose a commit message. Commit only after the user agrees.
