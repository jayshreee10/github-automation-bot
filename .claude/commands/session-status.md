---
description: Show progress of one session, or all sessions
argument-hint: "[session-number]"
---

Report build progress. Session requested: "$1" (empty means all sessions).

1. Read `docs/sessions.md`.
2. For the requested session (or each session), show: done tasks, remaining tasks, and whether its "Done when" condition is met.
3. Check the code for each ticked task. Flag any task that is ticked but not actually implemented, or implemented but not ticked.
4. Show the Deliverables tracker status and `git status` summary.

Output a compact table. Do not change any files.
