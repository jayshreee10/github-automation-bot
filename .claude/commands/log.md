---
description: Add an entry to a session log (summary, issue, root cause, fix)
argument-hint: <session-number> <summary|issue|root-cause|fix> <text>
---

Add one row to `.claude/sessions/session-$1/$2.md` (`summary` → `summary.md`, `issue` → `issues.md`, `root-cause` → `root-cause.md`, `fix` → `fixes.md`).

Text: $ARGUMENTS

- Date: today, `YYYY-MM-DD`.
- `issue`: next issue number, status `open`.
- `root-cause` / `fix`: link to the issue number; on `fix`, set that issue's status to `fixed`.
- `summary` / `fix`: fill the Files column from the current `git status` or the files just changed.
- One short line per cell. No extra descriptive text.

Show the added row when done.
