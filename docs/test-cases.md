# Product Test Cases

End-to-end test cases for the whole product, written from the user's point of view. They cover the flow in [`prd.md`](prd.md): sign in → connect a repo → receive webhooks → act on GitHub and Slack → see it all on the dashboard. The quality bar is covered too: forged requests, duplicates, lost events and secrets.

Run them on the deployed URL (or a local backend with smee) against a throwaway repository such as [`test-bot`](https://github.com/jayshreee10/test-bot).

**Priority:** P1 = core requirement, must pass · P2 = stretch goal or quality bar · P3 = polish.

**Setup before running**

- A GitHub account that owns a test repository, with the GitHub App installed on it.
- A Slack channel whose Incoming Webhook URL is set in `SLACK_WEBHOOK_URL`.
- A second GitHub account (or incognito window) for the access-control cases.
- `GITHUB_WEBHOOK_SECRET` available locally for the signature cases (never shared).

---

## 1. Sign in and session

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| AUTH-01 | Sign in with GitHub | Open the app signed out → **Continue with GitHub** → approve | Lands on the dashboard; sidebar shows name, initials and `@login` | P1 |
| AUTH-02 | Protected pages redirect | Signed out, open `/`, `/events`, `/rules`, `/failures` directly | Each redirects to sign-in; no data flashes | P1 |
| AUTH-03 | API needs a session | Call `/me`, `/stats`, `/events`, `/rules`, `/repositories`, `/app` with no token | `401` on every route | P1 |
| AUTH-04 | Sign out | Click sign out in the sidebar, then press Back | Returns to sign-in; Back does not show private data | P1 |
| AUTH-05 | Refresh keeps the session | Sign in, reload any page | Stays signed in on the same page | P2 |
| AUTH-06 | Cancel the OAuth prompt | Click **Continue with GitHub**, then deny on GitHub | Back on sign-in with no crash; can try again | P3 |

## 2. Connect repositories (GitHub App)

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| REPO-01 | Install the App | Repositories → **Install GitHub App** → pick repos → install | Redirects back; installation card lists the chosen repos | P1 |
| REPO-02 | Repository details | Open Repositories | Each repo shows full name, Public/Private, default branch, rule count, last event | P2 |
| REPO-03 | Account type and selection | Check the installation header | Shows "Personal account" or "Organization" and "all repos" / "selected repos" | P3 |
| REPO-04 | Add a repo on GitHub | In GitHub App settings, add another repo to the installation | Appears in the app without revisiting the setup URL (installation webhook) | P2 |
| REPO-05 | Remove a repo on GitHub | Remove a repo from the installation | Disappears from the list after the webhook or a sync | P2 |
| REPO-06 | Uninstall the App | Uninstall from GitHub settings | Installation and its repos are removed from the app | P2 |
| REPO-07 | Sync from GitHub | Click **Sync from GitHub** | Toast confirms; the list matches GitHub; missing fields backfill | P2 |
| REPO-08 | Configure link | Click **Configure on GitHub** | Opens the right settings page (user or org URL) | P3 |
| REPO-09 | Receiving vs Waiting | Compare a repo with events and one with none | "Receiving" with a last-event time vs "Waiting" / "No events yet" | P3 |
| REPO-10 | App permissions panel | Open the permissions and events panels | Lists the App's real permissions and subscribed events; no webhook URL or secret | P3 |
| REPO-11 | Claim someone else's installation | As user B, call `POST /installations` with user A's installation id | `403`; nothing linked to user B | P1 |
| REPO-12 | Multiple repos | Connect two repos | Both listed; sidebar count matches | P2 |

## 3. Webhook intake

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| HOOK-01 | Issue opened | Open an issue in the test repo | Event log shows `issues.opened` with title, author and repo within seconds | P1 |
| HOOK-02 | Pull request opened | Open a PR | Event log shows `pull_request.opened` | P1 |
| HOOK-03 | Push | Push a commit | Event log shows `push` with the branch | P1 |
| HOOK-04 | Ping | Redeliver the App's `ping` from GitHub | `200`; nothing stored in the event log | P3 |
| HOOK-05 | Unhandled event type | Trigger an event the bot doesn't handle (e.g. a star) | Acknowledged and dropped; not in the log | P3 |
| HOOK-06 | Fast response | Check the delivery in GitHub → App → Advanced | Responded `2xx` well under 10 s; work happens later in the queue | P2 |

## 4. Rules

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| RULE-01 | Create the PRD rule | New rule: issue opened, title contains `bug` → add label `bug` + Slack. Save | Rule listed as enabled; summary sentence matches the form | P1 |
| RULE-02 | Rule fires | Open an issue titled "bug: login fails" | Issue gets the `bug` label; Slack message arrives; event shows "Done · 2 actions" | P1 |
| RULE-03 | Rule does not fire | Open an issue titled "Feature request" | No label, no Slack; event shows "No rule matched" | P1 |
| RULE-04 | Case-insensitive keyword | Title "BUG in checkout" | Matches, same as RULE-02 | P2 |
| RULE-05 | Body contains | Rule on body `crash`; issue with "crash" only in the body | Matches | P2 |
| RULE-06 | Match all | Title contains `bug` AND author is you; open as another user | No match | P2 |
| RULE-07 | Match any | Match any: title `security` OR body `security`; keyword only in body | Matches | P2 |
| RULE-08 | Author is | Author is `alice`; issue by `alice` vs by `bob` | Only alice's issue matches | P2 |
| RULE-09 | Author is not | Author is not `dependabot[bot]` with match any | Dependabot's issue never matches, even if keywords hit | P2 |
| RULE-10 | Labels include | Labels include `docs`; open an issue with and without `docs` | Only the labelled issue matches | P2 |
| RULE-11 | Post a comment with placeholders | Comment body `Thanks {author}: {title} {url}` | Comment posted with real values; unknown placeholders not expanded | P1 |
| RULE-12 | PR rule | PR opened → label `needs-review` + comment | PR gets the label and comment | P1 |
| RULE-13 | Push rule, branch filter | Push rule, branch is `release` → Slack. Push to `release`, then `main` | Slack only for `release` | P2 |
| RULE-14 | Push rule allows Slack only | Try to save a push rule with Add label | Save blocked with a clear message | P2 |
| RULE-15 | Duplicate action types | Try two "Add label" actions in one rule | Blocked: one action of each type | P3 |
| RULE-16 | Validation | Save with an empty name, no actions, a 101-char name, or 21 keywords | Each blocked with a field error; nothing saved | P2 |
| RULE-17 | Disable a rule | Toggle a rule off, open a matching issue | No actions; toggle on and the next issue matches | P1 |
| RULE-18 | Edit a rule | Change the keyword, save, open issues with the old and new keyword | Only the new keyword matches | P1 |
| RULE-19 | Delete a rule | Delete via the row menu, confirm the dialog | Rule gone; past events no longer link to it | P2 |
| RULE-20 | Several rules match | Two rules match one issue | Both run; event lists actions from both | P2 |
| RULE-21 | Rules are per repo | Rule on repo A; open a matching issue in repo B | No action in repo B | P1 |
| RULE-22 | Fired stats | After RULE-02, open Rules | Fired count went up by one; "last fired" is recent | P3 |
| RULE-23 | Edit by URL | Open `/rules/<id>` directly and reload | Editor loads the rule | P3 |
| RULE-24 | Someone else's rule | As user B, open `/rules/<user A's id>` or `PATCH` it | `404`; no change | P1 |
| RULE-25 | Unsaved changes | Edit a field, then Cancel | "Unsaved changes" shows; Cancel discards | P3 |

## 5. Actions on GitHub and Slack

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| ACT-01 | Label is created if missing | Rule adds a label the repo doesn't have | Label created and applied | P2 |
| ACT-02 | Label already present | Issue opened with the label the rule adds | No error; still one label | P3 |
| ACT-03 | Slack content | Read the Slack message | Shows event, repo, title, author and a link that opens the issue/PR | P1 |
| ACT-04 | Action timing | Open the event detail | Each action shows status, attempt and duration | P3 |

## 6. Reliability (quality bar)

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| REL-01 | GitHub redelivers an event | GitHub → App → Advanced → **Redeliver** a processed delivery | No second label, comment or Slack message; still one row in the log | P1 |
| REL-02 | Same delivery sent twice at once | Send the same signed payload twice in parallel | One event and one set of actions | P1 |
| REL-03 | Slack down (permanent) | Point Slack at a rejected URL, open a matching issue | Label and comment succeed; Slack shows on Failures with the error | P1 |
| REL-04 | Transient failure retries | Make a downstream call return 5xx for a while | Job shows "Retrying n/5"; backoff ~30 s, 2 m, 8 m, 32 m; succeeds once the service is back | P2 |
| REL-05 | Retry reruns only failed actions | Fix Slack, click **Retry now** | Only Slack runs; label and comment not repeated ("skipped on retry") | P1 |
| REL-06 | Retry a finished job | Retry a job that already succeeded (API) | `409`; nothing runs | P3 |
| REL-07 | Dead letter | Let a job fail 5 times | Shows under Dead; stops retrying; can be retried by hand | P2 |
| REL-08 | Service was down | Stop the backend, open 2 issues, start it again | Within 15 min of boot, both events arrive and are processed once; "Missed deliveries caught up" counts them | P1 |
| REL-09 | Crash mid-job | Kill the process while a job runs, restart | Job is picked up again after the stale lock (5 min); comment not duplicated | P2 |
| REL-10 | Database briefly unavailable | Drop the DB connection while webhooks arrive | GitHub gets a non-2xx; the catch-up job recovers the delivery later | P2 |

## 7. Security

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| SEC-01 | No signature | `POST /webhooks/github` without `X-Hub-Signature-256` | `401`, no reason given; nothing stored | P1 |
| SEC-02 | Wrong secret | Sign the body with a different secret | `401` | P1 |
| SEC-03 | Tampered body | Take a valid signed payload and change one character | `401` | P1 |
| SEC-04 | Replayed request | Resend a captured, validly signed delivery | Accepted but treated as a duplicate; no new actions | P1 |
| SEC-05 | Secrets in the browser | Search the built JS bundle and network responses for tokens, keys, webhook URLs | None found | P1 |
| SEC-06 | Secrets in the repo | Scan git history for `.env`, keys, tokens | Only `.env.example` with placeholders | P1 |
| SEC-07 | Secrets in logs | Trigger a failure (e.g. bad Slack URL) and read the logs | Tokens, secrets and the Slack URL are redacted | P1 |
| SEC-08 | Raw payload never exposed | Inspect `/events/:id` | Only the summary; the "payload excerpt" is rebuilt, not the raw body | P2 |
| SEC-09 | Cross-user data | As user B, call `/events`, `/events/<A's id>`, `/failures`, `/stats`, `/jobs/<A's id>/retry` | Only B's own data; A's items are `404` | P1 |
| SEC-10 | Search injection | Search for `%`, `_`, `'`, `' OR 1=1 --` | Treated as literal text; no error, no extra rows | P2 |

## 8. Dashboard

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| DASH-01 | Stat cards | Open the dashboard after a few test events | Events (24 h), "vs yesterday", actions by type, failed jobs, active rules match the data | P1 |
| DASH-02 | Live refresh | Keep the dashboard open, open an issue on GitHub | New row appears within ~5 s without reloading | P1 |
| DASH-03 | Action chips and status | Look at live activity rows | Chips like "label: bug", "comment", "Slack"; status Done / Retrying n/5 / No rule matched | P2 |
| DASH-04 | Job queue and bars | Compare with Failures and the event log | Pending, Done, Retrying, Dead and bar counts agree | P3 |
| DASH-05 | Webhook health | Check the sidebar box | "Webhook healthy", last delivery time, queue size | P3 |
| DASH-06 | Empty account | Sign in as a new user with no repos | Empty states with a prompt to install the App; no errors | P2 |
| DASH-07 | Card links | Click Failed jobs and Active rules cards | Open Failures and Rules | P3 |

## 9. Event log

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| LOG-01 | Every event listed | Compare with GitHub's delivery list | Every handled delivery appears once, newest first | P1 |
| LOG-02 | Type tabs | Switch All / Issues / Pull requests / Push | List filters; "Showing x of y" updates | P2 |
| LOG-03 | Status filter | Filter by status | Only matching rows | P2 |
| LOG-04 | Search | Search by title, author, and first chars of a delivery id | Each finds the right event | P2 |
| LOG-05 | Paging | Next, then Previous, with more than one page | Pages move both ways without gaps or repeats | P2 |
| LOG-06 | Detail panel | Click a row | Shows delivery id, received time, job attempts, "Verified HMAC-SHA256", matched rule sentence, actions, payload excerpt | P1 |
| LOG-07 | Deep link | Copy the URL with `?delivery=` and open it in a new tab | Same detail opens | P3 |
| LOG-08 | Detail links | **View on GitHub**, **Copy delivery ID**, **Edit rule** | Open the issue, copy the id, open the rule editor | P3 |

## 10. Failures and retries

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| FAIL-01 | Failure listed | After REL-03, open Failures | Row per failing action: type, error, attempts n/5, next try time | P1 |
| FAIL-02 | Tabs | Switch Retrying / Dead | Each shows the right jobs; sidebar count = retrying + dead | P2 |
| FAIL-03 | Job details | Select a failure | Status, attempts, last error, next run and all the delivery's actions | P2 |
| FAIL-04 | Retry now | Click **Retry now** after fixing the cause | Row leaves the list; event turns Done | P1 |
| FAIL-05 | Backoff copy | Read the backoff note | Says ×4 (30 s, 2 m, 8 m, 32 m) | P3 |

## 11. Repository filter, theme and layout

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| UI-01 | Repo filter | Pick a repo in the top bar | Dashboard, event log, rules and failures show only that repo; `?repo=` in the URL | P2 |
| UI-02 | Filter persists | Navigate between pages and reload | Filter stays | P3 |
| UI-03 | New rule preselects repo | With a filter set, click **New rule** | Repository field is prefilled | P3 |
| UI-04 | Dark mode | Toggle the theme and reload | Theme applies everywhere and is remembered | P3 |
| UI-05 | Loading and errors | Throttle the network / stop the backend | Loading states, then a clear error; no blank screen | P2 |

## 12. Deployment and health

| ID | Scenario | Steps | Expected | P |
| --- | --- | --- | --- | --- |
| DEP-01 | Public URL | Open the deployed URL in a fresh browser | App loads over HTTPS | P1 |
| DEP-02 | Health check | `GET /health` | `{ "status": "ok", "db": "ok" }` | P2 |
| DEP-03 | Cold start | Hit the app after the free host has slept | Loads after the wake-up; webhooks sent during sleep are recovered (REL-08) | P2 |
| DEP-04 | README walkthrough | Follow the README from a clean clone | Runs locally with `.env.example` filled in | P1 |
| DEP-05 | API docs | Open Swagger (`/api/docs`) | Every endpoint and field listed | P3 |

## 13. Full journey (smoke test)

Run this one after every deploy. It touches every core requirement.

1. Sign in with GitHub (AUTH-01).
2. Install the App on the test repo; it shows under Repositories (REPO-01).
3. Create "Bug triage": issue opened, title contains `bug` → label `bug`, comment, Slack (RULE-01).
4. Open issue "bug: smoke test" → label, comment and Slack within seconds (RULE-02, ACT-03).
5. Dashboard updates live; event log detail shows the rule and three actions (DASH-02, LOG-06).
6. Redeliver the delivery from GitHub → nothing is repeated (REL-01).
7. Send an unsigned request to the webhook → `401` (SEC-01).
8. Close the issue and delete the rule to clean up.

---

## Not covered yet

- **AI triage** (summary, suggested label, priority): planned for Session 7, not built. Add cases when it lands.
- **Transient 5xx from Slack on the live URL**: config only allows `hooks.slack.com` URLs, so it can't be stubbed live. Unit tests cover it.
