---
description: Safely stage and commit the current step
argument-hint: "[optional message hint]"
---

Commit the current work. Hint from the user: "$ARGUMENTS"

1. Run `git status` and `git diff --stat`.
2. Stop and warn if anything that should be ignored is present: `node_modules`, build output, `.env` files, `*.pem`, logs, editor/OS files. Suggest the `.gitignore` fix.
3. Run the `/check-secrets` steps on the changed files.
4. Stage only relevant files by name (never `git add -A` blindly).
5. Propose a short conventional message (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) describing why, not just what.
6. Commit after the user agrees. Never push unless asked.
