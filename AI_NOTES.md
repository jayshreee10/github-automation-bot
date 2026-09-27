# AI notes

## Tools, and who did what

Claude Code was the only AI tool, running Claude Opus. Two things in the setup mattered: vendor skills under `.claude/skills/` for NestJS, Prisma, Neon and shadcn, so suggestions matched the versions pinned in `docs/tech-stack.md` rather than what the model remembered, and slash commands for the session workflow (`/start-session`, `/commit`, `/issue`, `/log-ai`), described in `docs/commands.md` and dropped from the repo in `25443ad`.

The split: I wrote the build plan (`docs/sessions.md`) and the phase plans in `docs/phase/`, so every session started from a spec I had already argued with myself about. The AI wrote most of the implementation and the unit tests against those plans. Everything outside the editor was mine: the Neon project, the GitHub App, the Slack webhook, the hosting accounts, and the `gh` end-to-end runs against a throwaway repository. Every page also got a pass in the browser at the end of a session, which is where bugs turned up that no unit test would have caught. I read every diff before it became a commit, and pushing needed my approval each time (an `ask` rule in `.claude/settings.json`).

Six sessions, from local skeleton to deployed.

On context files: the AI's working context was `docs/sessions.md`, `docs/tech-stack.md` and the phase plans, which is where the conventions live. `AGENTS.md` and `CLAUDE.md` were written at the end and point at those documents rather than pretending to predate them.

## Decisions I made

Sign-in and repo access are two separate systems. Users sign in through Neon Auth (managed Better Auth, GitHub provider); the app reads repos through a GitHub App installation, and the two are joined by checking the installing GitHub account id against the signed-in user's. Sign-in needs sessions and JWTs I did not want to hand-roll, and only the App gives per-installation tokens and webhooks. Plain OAuth for both would have meant storing a user token and acting as the user.

The queue is Postgres rather than Redis. A free tier with no card ruled out managed Redis, and BullMQ would have bought scheduling I do not need while the durability guarantee still rested on the same database. The host also sleeps when idle, which turns "never lose an event" from a queue problem into a redelivery problem, and redelivery is something GitHub will do for me if the app asks on boot.

Idempotency belongs in the schema, not in application code. GitHub will redeliver and my own worker will retry, so "did this already happen" is a unique constraint the database enforces whatever the code above it does. Ownership is the other schema-shaped call: rules resolve through repo, then installation, then user, so a repo transfer carries its rules with it, and someone else's id returns 404 rather than 403 because a 403 confirms the row exists.

One of these I got wrong first. Slack started as a single global webhook URL in env, on the grounds that a demo does not need secret storage. That made the app single-tenant in the one place a reviewer would look, so `4ae0a2a` moved it to per-user encrypted settings instead.

## The hardest wrong turn

The action runner writes one row per side effect and increments `attempts` on it. As the AI wrote it, that row was updated after the side effect succeeded, which reads as the obvious order and passed its tests.

The hole is the crash window. If the process dies between posting a comment on GitHub and saving the result, the row still says zero attempts. On retry the runner treats it as a first attempt, skips the lookup that would find the existing comment by its marker, and posts a second one. So the idempotency guarantee held only when nothing crashed, which is the one case it exists for, and the AI's tests were written against the same wrong assumption, so nothing was going to fail.

I found it by reading that window on purpose before running anything. `begin()` now increments attempts before the side effect, so a second pass knows it may already have acted and looks for the comment first (`backend/src/modules/actions/action-runner.ts`). Verified by resetting the comment action and re-running: same comment id recovered, nothing new posted. Fix and test shipped with the feature in `530f1ee`, so the duplicate path never reached `main`, and `action-runner.spec.ts` fails without it.

The same shape returned in session 5. My plan had the retry endpoint accept only `failed` and `dead` jobs, but a bad Slack URL is a permanent action failure, so the job finishes `succeeded` with a failed action inside it, and Retry would have answered 409 on the one failure a user is most likely to cause. It now also takes `succeeded` jobs holding failed actions and resets those actions in the same transaction. Both bugs came from reasoning about the happy path and the obvious failure while skipping the state in between.

The browser pass caught a third: a new rule silently defaulted to the first of 55 repositories, so one missed click in the dropdown would have created a rule on the wrong repo. There is no default now.

Session 1 was a wrong turn of a different kind. The Nest test scaffold was stripped to reach a running skeleton faster, which held for three sessions and then had to be paid back in `d7d675b`, backfilling unit tests for phases 1 to 4 across both apps.

## With more time

The AI step (stretch goal 2) is not built. It is specced as session 7 in `docs/sessions.md`, behind a Groq or Gemini key, and it lost every scheduling argument to reliability work because the core flow had to stand without it. After that: rate limits on the public endpoints, and the real SQL covered against a Neon test branch. The claim query and the persist-and-enqueue transaction are the pieces most likely to break under concurrency, and today only the `gh` runs touch them.

## One prompt

From the session 4 log, the instruction that shaped how the AI worked: "complete the full task at a go", and "fix the bugs simultaneously".

Long uninterrupted runs produced a session's worth of code quickly and left me a large diff to read at the end. The crash-window bug was in one of those diffs. The reading pass that caught it is the part I would not hand over.
