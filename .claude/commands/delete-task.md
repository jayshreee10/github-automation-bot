---
description: Remove a task from a session plan
argument-hint: <session-number> <task text or keyword>
---

Remove a task from Session $1 in `docs/sessions.md`. Task to remove: $ARGUMENTS

1. Find the matching task line(s) in Session $1. If more than one matches, list them and ask which.
2. Check the spec (`docs/prd.md`). If the task covers a core requirement, quality-bar item or deliverable, warn the user before deleting.
3. Show the line(s) to be removed and the coverage table rows affected.
4. Delete only after the user confirms. If code for the task already exists, list it but do not delete code.
