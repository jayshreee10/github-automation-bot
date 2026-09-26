# AI log

Short entries per session; condensed into `AI_NOTES.md` in Session 6.

## Session 4 — 2026-09-26
- Tools/models: Claude Code (Opus 5.5).
- AI did / I did: AI implemented rule schema, matcher, rules API, action runner, queue handler and ran the `gh` end-to-end checks; I set up Slack, approved the plan and asked for one uninterrupted run.
- Decisions I made (and why): one global Slack webhook (demo scope, no secret storage in the DB); rules scoped through repo → installation → user so transfers carry rules along; other users' ids return 404, not 403.
- Where the AI was wrong (symptom → how noticed → fix): the action runner counted `attempts` only after the side effect, so a crash between posting a comment and saving it looked like a first attempt and would skip the marker lookup → a duplicate comment. Noticed while re-reading the crash window before testing → `begin()` increments attempts before the side effect; verified by resetting the comment action and re-running (same comment id recovered, no new comment). Also, the plan put the rules handler alongside the existing events handler, but the queue allows one handler per event; the rules handler replaced it instead.
- Prompt worth keeping (optional, short): "complete the full task at a go … fix the bugs simultaneously".

## Session 5 — 2026-09-26
- Tools/models: Claude Code (Opus 5.5).
- AI did / I did: AI built request/delivery ids in logs, the events/stats/failures APIs with retry, and the events, rules and failures pages with tests; I asked for phase 5 to be implemented from the plan.
- Decisions I made (and why): repo filter in the URL, not a store; polling pauses when the tab is hidden; applied a second session's pending migration so the e2e run could finish on the combined code.
- Where the AI was wrong (symptom → how noticed → fix): the plan's retry only accepted `failed`/`dead` jobs, but a wrong Slack URL is a *permanent* action failure, so the job ends `succeeded` and Retry would have returned 409 → noticed while reading the action runner before coding → retry also accepts `succeeded` jobs with failed actions and resets those actions to `pending` in the same transaction.
- Also wrong, caught in Chrome: status badge colours never showed (layered `@apply` rules lose to shadcn's utility classes → moved unlayered); a new rule silently defaulted to the first of 55 repos, so a missed dropdown click created a rule on the wrong repo (→ no default without a filter). Two sessions editing the same files meant a rebuilt backend queried an unapplied column and the failures API shape changed under the UI; found from the job error and a zod parse failure.
