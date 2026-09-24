---
description: Scan for leaked secrets and ignored files
---

Check the repository for secrets before committing.

1. Confirm `.gitignore` covers `.env*` (except `.env.example`), `*.pem`, `node_modules/`, and build output.
2. Search tracked and staged files for likely secrets: private key blocks, `ghp_`/`ghs_`/`github_pat_` tokens, `xoxb-` and `hooks.slack.com/services/` URLs, AI API keys, Postgres connection strings with passwords.
3. Confirm `.env.example` has placeholders only.
4. Check that no secret reaches the Next.js client: only `NEXT_PUBLIC_*` vars are exposed, and none of them are secrets.
5. Check that logging code redacts tokens, signatures and cookies.

Report findings as a list with file and line. Do not modify files unless the user asks.
