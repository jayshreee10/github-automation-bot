# Phase 4 — Rules and actions

Turn queued events into side effects. A pure matcher checks each event against the user's rules for that repo; matching rules add labels, post comments and send Slack notifications. Every side effect is recorded in `actions` under a unique key, so a retried or redelivered event never acts twice. This is Session 4; the rules UI is phase 5.

Sources: [`prd.md`](../prd.md) · [`tech-stack.md`](../tech-stack.md) · [`sessions.md`](../sessions.md) (Session 4) · [phase 3](phase-3.md)

---

## 1. Scope

| In scope                                                                                 | Out of scope (later phases)                             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Rule shape (zod): event, conditions, actions — shared by API and matcher                  | Rules UI, event log, failures page (phase 5)            |
| Pure matcher: event action, title/body keywords, author, labels, branch (push)           | Per-user Slack channels (one workspace webhook for now) |
| Actions: add label, post comment, Slack notification                                     | AI triage action (Session 7)                            |
| `actions` row per (delivery, rule, type); succeeded actions skipped on retry              | Rate limiting (Session 6)                               |
| Error classes: transient → job retries, permanent → action `failed`, no retry             | Templating beyond a few fixed placeholders              |
| Loop guard: ignore events sent by the bot itself                                         |                                                         |
| Rules CRUD API (`/api/rules`), scoped to the caller's repos                              |                                                         |

Installation tokens were built early in phase 2 (`installation-token.service.ts`); this phase only adds the 401 → refresh path.

### PRD requirements covered

| PRD item                                    | How this phase covers it                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Core 4 — write back to GitHub               | Add label / post comment on issues and PRs via installation token                                       |
| Core 5 — Slack notification                 | `slack_notify` action through an Incoming Webhook                                                       |
| Stretch 1 — configurable rules              | Rules stored per repo with keyword / author / label conditions; CRUD API now, UI in phase 5            |
| Stretch 3 — GitHub App auth                 | All writes use the installation token, never a user token                                               |
| Quality 2 — no duplicate actions            | `UNIQUE(delivery_id, rule_id, type)`; succeeded rows skipped; comment marker check before re-posting    |
| Quality 3 — no lost events                  | A failed action fails the job, which retries with phase 3's backoff; other actions keep their results   |
| Quality 4 — never expose secrets            | Slack webhook URL only in `backend/.env`, already masked by the logger's Slack pattern                  |

---

## 2. How the flow works

```mermaid
sequenceDiagram
    participant W as Worker (phase 3)
    participant H as Rules handler
    participant DB as Neon Postgres
    participant GH as GitHub API
    participant SL as Slack

    W->>H: job for delivery (issues / pull_request / push)
    H->>H: RepoEvent from payload; sender is the bot → done
    H->>DB: enabled rules for (repository_id, event)
    H->>H: match(rule, event) — pure, no I/O
    loop each matching rule × action
        H->>DB: INSERT action (pending) ON CONFLICT DO NOTHING, read status
        alt already succeeded / skipped
            H->>H: skip
        else pending / failed
            H->>GH: add labels / post comment (installation token)
            H->>SL: POST Incoming Webhook
            H->>DB: action → succeeded (result) or failed (error), attempts + 1
        end
    end
    H-->>W: throw if any action failed transiently → job retries; else succeed
```

### Rule shape

```jsonc
{
  "name": "Bug triage",
  "repositoryId": "123456",
  "event": "issues",                         // issues | pull_request | push
  "conditions": {
    "actions": ["opened"],                   // default ["opened"]; not used for push
    "titleContains": ["bug", "crash"],       // any, case-insensitive
    "bodyContains": [],
    "authors": [],                           // GitHub logins, any
    "labels": [],                            // event has any of these
    "branches": []                           // push only: ref without refs/heads/
  },
  "actions": [
    { "type": "add_label", "labels": ["bug"] },
    { "type": "add_comment", "body": "Thanks @{author}, we'll look at this." },
    { "type": "slack_notify" }
  ],
  "enabled": true
}
```

**Matching:** every non-empty condition must hold (AND); inside one list any value is enough (OR). Empty conditions match every event of that type. Keywords match whole words, case-insensitive.

**Key rules**

- The matcher is a pure function `(rule, RepoEvent) → boolean`, so it is easy to reason about and reuse for a "preview" later.
- At most one action of each type per rule — the unique key is `(delivery, rule, type)`. `add_label` takes a list of labels, so this is no real limit.
- `add_label` and `add_comment` are only valid for `issues` and `pull_request` (a push has nothing to label). Enforced by the zod schema at create time.
- **Idempotency:** a succeeded action is never repeated. The only unsafe window is a crash after the side effect but before `succeeded` is saved:
  - Labels: adding an existing label is a no-op on GitHub, so a repeat is harmless.
  - Comments: each comment carries a hidden marker `<!-- bot:{deliveryId}:{ruleId} -->`; on a retry (attempts > 0) the handler first looks for it and marks the action succeeded instead of posting again.
  - Slack: no read-back exists, so a crash in that exact window can send twice. Documented as the one known at-least-once edge.
- **Loop guard:** events whose `sender.login` is `<GITHUB_APP_SLUG>[bot]` are ignored, and the default action filter is `opened`, so the bot's own labels and comments never trigger rules.
- Untrusted text: issue titles and logins are escaped for Slack (`&`, `<`, `>`) so a title like `<!channel>` can't ping the workspace. Comment placeholders are limited to `{author}`, `{title}`, `{url}`.

### Error handling

| Response                                          | Class     | Effect                                                   |
| ------------------------------------------------- | --------- | -------------------------------------------------------- |
| Network error, GitHub/Slack `5xx`, `429`, GitHub `403` rate limit | Transient | Action `failed`, job retries with backoff        |
| GitHub `401`                                      | Transient | Drop the cached installation token, retry                |
| GitHub `404` / `410` (issue or repo gone), `422`  | Permanent | Action `failed` with error, not retried                  |
| Slack `400` / `403` / `404` (bad or revoked webhook) | Permanent | Action `failed`; logged as a config problem           |

If every remaining failure is permanent, the job ends `succeeded` (nothing more to do); the failed actions stay visible for phase 5.

---

## 3. What you need to do (manual steps)

**Never paste the webhook URL into chat or commit it — it is a secret.**

### Step 1 — Slack workspace and channel

Create a free Slack workspace (or use one you own) and a channel, e.g. `#github-bot`.

### Step 2 — Slack app with an Incoming Webhook

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**, name it, pick the workspace.
2. **Incoming Webhooks** → toggle **On** → **Add New Webhook to Workspace** → pick the channel → **Allow**.
3. Copy the webhook URL (`https://hooks.slack.com/services/…`).

### Step 3 — Fill the env file

`backend/.env` (add)

```
SLACK_WEBHOOK_URL=<webhook URL>
```

### Step 4 — Check the test repo

The App is installed on [`jayshreee10/test-bot`](https://github.com/jayshreee10/test-bot) with Issues and Pull requests set to **Read & write** (phase 2). Nothing else to do.

### Step 5 — Tell Claude "phase 4 setup done"

---

## 4. What Claude builds

### Packages

None. Slack and GitHub calls use built-in `fetch`.

### Backend (`backend/src/`)

| #   | File                                     | What it does                                                                                                                                                   |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `config/env.ts`, `.env.example`          | `SLACK_WEBHOOK_URL` (must start with `https://hooks.slack.com/`); optional so the app boots without it — Slack actions then fail as permanent with a clear error |
| B2  | `rules/rule.schema.ts`                   | zod: conditions, discriminated action union, create/update bodies; event ↔ action compatibility; length limits (labels ≤ 50 chars, comment ≤ 2 000)            |
| B3  | `rules/rule-matcher.ts`                  | Pure `matches(rule, event)`: action filter, word-boundary keywords, authors, labels, branches                                                                 |
| B4  | `rules/rules.service.ts`                 | CRUD scoped by `userId` and repo ownership (repo → installation → user); `findActive(repoId, event)` for the handler                                           |
| B5  | `rules/rules.controller.ts`              | `GET /api/rules?repositoryId=`, `POST /api/rules`, `PATCH /api/rules/:id`, `DELETE /api/rules/:id`; not-owned → `404`; Swagger schemas                           |
| B6  | `actions/action-runner.ts`               | For one (delivery, rule, action): `createMany … skipDuplicates`, read row, skip if done, run executor, save result/error and attempts                          |
| B7  | `actions/errors.ts`                      | `TransientActionError` / `PermanentActionError`; mapping from HTTP status per the table above                                                                  |
| B8  | `actions/github-actions.ts`              | `addLabels` (`POST /repos/{o}/{r}/issues/{n}/labels`), `addComment` with marker + marker lookup on retry (`GET …/comments`, newest first, bot author only)     |
| B9  | `actions/slack-notifier.ts`              | Block Kit message: repo, event, title linked to GitHub, author, rule name; escapes untrusted text; 5 s timeout                                                  |
| B10 | `github/github-client.ts`                | `POST` support; on `401` invalidate the installation token cache once and retry                                                                               |
| B11 | `rules/rules-event.handler.ts`           | Registered in phase 3's handler registry for `issues`, `pull_request`, `push`: loop guard → load rules → match → run actions → throw if any transient failure   |
| B12 | `rules/rules.module.ts`, `actions/actions.module.ts` | Wiring                                                                                                                                             |

### Frontend

None. Rules are created through Swagger UI (`/api/docs`) or `curl` until phase 5 adds the rules page.

### Order of work (one commit each)

1. B2–B3 rule schema + pure matcher.
2. B4–B5 rules CRUD API → create a rule for `test-bot` via Swagger.
3. B6–B10 action runner, GitHub and Slack executors, error mapping.
4. B11–B12 handler wired into the queue → end-to-end on `test-bot`.
5. Session logs, docs update.

---

## 5. Environment variables

| Variable            | Where          | Secret? | Source                               |
| ------------------- | -------------- | ------- | ------------------------------------ |
| `SLACK_WEBHOOK_URL` | `backend/.env` | **Yes** | Slack app → Incoming Webhooks        |

---

## 6. Security checklist

- [ ] Every rules query filters by the caller's `userId` through repo → installation; another user's rule id returns `404`.
- [ ] `repositoryId` in a create body is checked for ownership, never trusted.
- [ ] Rule text lengths capped; placeholders are a fixed list (no templating engine, no code execution).
- [ ] Slack text escapes `&`, `<`, `>` from payload fields (no `<!channel>` injection).
- [ ] Slack webhook URL and installation tokens never logged, never returned by the API; error messages stored in `actions.error` are passed through `redact()`.
- [ ] Bot's own events ignored (no label/comment loops).

---

## 7. Done when (verify together on `test-bot` with `gh`)

Rule under test: `issues`, `titleContains: ["bug"]` → `add_label ["bug"]`, `add_comment`, `slack_notify`.

| #   | Check                                                                                                  | Expected                                                                 |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | `gh issue create -R jayshreee10/test-bot --title "bug: app crashes" --body "…"`                         | `bug` label + one comment on the issue; one Slack message                |
| 2   | `gh issue view <n> -R jayshreee10/test-bot --json labels,comments`                                     | Exactly one label and one bot comment                                    |
| 3   | Redeliver that delivery from the App's **Advanced** tab                                                | No new comment, no new Slack message                                     |
| 4   | Reset the job to `pending` in SQL and let it re-run                                                    | 3 actions skipped, nothing repeated                                      |
| 5   | Issue titled "feature: dark mode"                                                                      | No actions; job `succeeded`                                              |
| 6   | Temporarily set a wrong `SLACK_WEBHOOK_URL`, open a "bug" issue                                        | Label + comment succeed; Slack action `failed` (permanent), not retried  |
| 7   | Disconnect network briefly while a job runs                                                            | Job retries; after reconnect, only the missing actions run               |
| 8   | Open a PR with a `pull_request` rule                                                                   | Label + comment on the PR                                                |
| 9   | `curl` `PATCH /api/rules/<id>` with another user's rule id / repo id                                   | `404`                                                                    |
| 10  | Backend logs + `/check-secrets`                                                                        | No Slack URL, tokens or payload bodies                                   |

Clean up afterwards: `gh issue close` / `gh pr close --delete-branch`.

---

## 8. To confirm while building

| Question                                                                       | Why it matters                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Does `POST …/issues/{n}/labels` create a missing label automatically?          | If not, create it first (`POST /repos/{o}/{r}/labels`, ignore `422` exists)     |
| One global Slack webhook vs per-user webhook stored in the DB                  | Per-user needs encryption at rest; global is enough for the demo                |
| Should a rule edited between retries use the new or old version?                | Plan: current version; a disabled rule's pending actions are marked `skipped`   |
| Word-boundary keywords vs plain substring                                      | "bug" should not match "debug"; word boundary planned                          |
| Exact bot login format in `sender.login` (`<slug>[bot]`)                       | Loop guard depends on it                                                        |

---

## 9. Follow-ups in `sessions.md`

- Session 4: link this plan; tick "Installation token service" (done in phase 2).
- Session 5: rules page uses the same field names as `rule.schema.ts`; failures page shows `actions.error` and allows retry.
- Session 7: `ai_triage` becomes another action type in the runner.

---

## References

- [REST: add labels to an issue](https://docs.github.com/en/rest/issues/labels#add-labels-to-an-issue)
- [REST: create an issue comment](https://docs.github.com/en/rest/issues/comments#create-an-issue-comment) — PRs use the issues endpoints
- [Rate limits for GitHub Apps](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [Slack: sending messages with Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Slack: formatting and escaping text](https://api.slack.com/reference/surfaces/formatting#escaping)
