---
name: verify-before-deploy
description: "Load before preparing a deployment, before responding to a request to check whether changes are ready to ship, and before stating or implying that work is complete, done, or ready. Runs this project's actual typecheck/lint/test/build commands and reports their real output rather than assuming success. After a deployment has been explicitly approved by the user and has actually completed, also checks the real production URL for the change with curl and reports the true HTTP status and response. Does not initiate deployments, publish content, run SQL against the live database, or call paid APIs itself."
---

## When this applies

A request to prepare for deployment, a question like "is this ready?" / "can we ship this?", or any point where you're about to tell the user something is done, working, or passing.

## Hard rule

**Never claim a check passed, or that production is working, without having actually run it this session.** "This should work" or "this is likely fine" is not a substitute for running the command and reading its real output.

## The local verification chain

Run these, in this order, using the project's own scripts (don't invent ad-hoc alternatives):

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
npm run build       # next build
```

Report the actual result of each — pass/fail, and the real error text if something fails. A warning is not a failure; an error is. If a step fails, stop and report that plainly rather than continuing to the next step and glossing over it.

If a change only touches one area (e.g. a single lib file and its test), it's fine to scope `lint`/`typecheck` to the touched files for a quick pass, but `npm test` and `npm run build` should still run against the whole project before calling anything ready — a change can break something outside the files you touched.

## What this skill does NOT do

- Does not run `git push`, `vercel deploy`, or any deployment command itself.
- Does not run SQL against Supabase, even to "just check" something.
- Does not call a paid external API (Anthropic, YouTube, Instagram/Meta Graph) to verify a code path works — code review and the local verification chain above are the ceiling for anything that would cost money or publish content, unless the user explicitly approves that specific call.
- Does not publish, post, or otherwise make anything public.

If preparing for deployment surfaces one of the above as seemingly necessary, say so and ask, rather than doing it.

## After an approved deployment has actually completed

Only once the user has explicitly approved a deployment AND it has actually finished (not "about to deploy," not "deploying now" — actually done):

1. Identify the real production URL for the change. This project's known live paths include `https://salzman-baseball.vercel.app/coach`, `/pitcher`, `/cmj`, `/social`, `/social/radar`, `/ideas` (see `PROGRESS.md` for the canonical list) — pick whichever path is actually relevant to what changed, not a default.
2. `curl -s -o /dev/null -w '%{http_code}' <url>` (or a fuller `curl -i` if response body/headers matter for this change) against that real URL.
3. Report the actual HTTP status code and any meaningful response detail (error body, redirect target, obviously wrong content) — not an assumption that a 200 means the specific feature works, if the check can't actually distinguish that.

## If no deployment has been approved or has completed

**State this explicitly and plainly: live production verification has not occurred and remains outstanding.** Do not imply it happened, and do not skip stating it just because the local chain above passed — local checks and a working production deployment are different claims.
