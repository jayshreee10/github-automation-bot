# Commands

Custom Claude Code slash commands for working through [`sessions.md`](sessions.md). Each command is defined in [`.claude/commands/`](../.claude/commands/) and is typed in the Claude Code prompt.

## Session workflow

| Command | Example | What it does |
|---|---|---|
| `/start-session <n>` | `/start-session 1` | Reads the plan and context files, checks earlier sessions are finished, and proposes a plan for session *n*. Waits for approval before coding. |
| `/session-status [n]` | `/session-status 3` | Shows done and remaining tasks for session *n* (all sessions if *n* is omitted). Flags tasks that are ticked but not built, or built but not ticked. Read-only. |
| `/end-session <n>` | `/end-session 1` | Runs the end-of-session checklist: verify and tick tasks, update `CLAUDE.md` / `AGENTS.md`, draft the `ai-log` entry, check for secrets, propose a commit. |
| `/next` | `/next` | Suggests the single next task in the current session. |

## Editing the plan

| Command | Example | What it does |
|---|---|---|
| `/update-session <n> <change>` | `/update-session 4 add author-based rule matching` | Adds or changes tasks in session *n*. Shows a before/after and applies it only after you confirm. |
| `/delete-task <n> <task>` | `/delete-task 5 repository filter` | Removes a task from session *n*. Warns if the task covers a spec requirement. Never deletes code. |

## Everyday helpers

| Command | Example | What it does |
|---|---|---|
| `/commit [hint]` | `/commit webhook signature check` | Checks for ignored or secret files, stages relevant files by name, proposes a conventional commit message. Never pushes. |
| `/check-secrets` | `/check-secrets` | Scans for leaked tokens, keys and `.env` files, secrets exposed to the Next.js client, and missing log redaction. Read-only. |
| `/issue <description>` | `/issue duplicate Slack message when webhook is redelivered` | Finds the session that owns the affected code, logs the issue, finds the root cause, proposes a fix (applied after approval), and records it in that session's `issues.md`, `root-cause.md` and `fixes.md`. |
| `/log <n> <type> <text>` | `/log 3 issue webhook rejected valid signature` | Adds a dated row to `.claude/sessions/session-n/` — type is `summary`, `issue`, `root-cause` or `fix`. |
| `/log-ai <note>` | `/log-ai AI verified the signature on parsed JSON instead of the raw body` | Adds a note to `docs/ai-log.md` under the current session. |
| `/sync-docs` | `/sync-docs` | Brings `CLAUDE.md`, `AGENTS.md` and `README.md` in line with the current code. |

## Typical session

```
/start-session 2      → review the plan, approve
  … build …
/commit               → after each logical step
/log <n> <type> …     → on every change, feature, issue, root cause, fix
/issue <description>  → when something breaks: log → root cause → fix
/log-ai <note>        → whenever the AI gets something wrong or you make a key decision
/session-status 2     → check progress
/end-session 2        → close out
```
