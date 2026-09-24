---
description: Report an issue, find its root cause, fix it, and log it in the right session
argument-hint: <issue description>
---

Issue reported: $ARGUMENTS

1. **Find the session.** Match the affected module or feature to the session that built it in `docs/sessions.md` (e.g. webhooks → 3, rules/actions → 4, dashboard → 5). If unclear, use the current session (first with unticked tasks). State which session and why.
2. **Log the issue.** Add a row to `.claude/sessions/session-N/issues.md`: next number, today's date (`YYYY-MM-DD`), short issue text, status `open`.
3. **Investigate.** Reproduce or trace it in the code. Identify the real cause, not the symptom. Add a row to `root-cause.md` with the issue number.
4. **Propose the fix.** Show the minimal change and the files touched. Wait for approval before editing.
5. **Fix and verify.** Apply the change and confirm it works. Add a row to `fixes.md` (issue number, date, fix, files) and set the issue status to `fixed`.
6. **Follow-ups.**
   - If the fix changes behaviour or adds a feature, add a row to that session's `summary.md`.
   - If new work is needed that isn't in the plan, suggest `/update-session N …`.
   - If the issue came from an AI suggestion, suggest `/log-ai` with symptom → how noticed → fix.

Keep every log row to one short line per cell. No extra descriptive text.
