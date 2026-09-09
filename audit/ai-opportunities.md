# AI integration opportunities — Salzman Baseball

The app currently uses no AI at runtime. The one place a model touches this workflow today is manual: a coach clicks "Claude," a prompt gets copied to the clipboard, and claude.ai opens in a new tab for them to paste into by hand (`app/coach/page.tsx:763` `buildPrompt()`). Everything below is scoped against that baseline — real insertion points where a server-side model call would replace either dropped user input, a canned string, or a manual copy/paste step, not places where AI would be decoration.

---

### 1. Fuzzy exercise-name matching for bulk program import

Where: `app/coach/page.tsx:553-590` (`parseAndImportProgram`)

Today: a coach pastes a pipe-delimited program (`Category | Exercise Name | 3x5 @ 70`) and every line is matched against `BUILT_IN_EXERCISES`/`customExercises` with exact, case-insensitive string equality (`app/coach/page.tsx:579`: `e.name.toLowerCase()===exName.toLowerCase()`). A typo, abbreviation ("DB Bench" vs "Dumbbell Bench Press"), or synonym silently drops the whole line into a `skipped` array. The coach sees a count ("Skipped 4: Not in library: DB Bench...") but has to manually diff their paste against the ~80-exercise library to fix it.

With a model: send the unmatched line plus the full valid exercise-name list; ask the model to either pick the single best match or say "no match" — never invent a new exercise name.

Input: the raw unmatched `exName` string, plus the complete `BUILT_IN_EXERCISES`/`customExercises` name list for this coach's library (roster is fixed, ~80-120 names — small enough to send in full every time, no retrieval needed).

Output shape:
```json
{ "match": "Dumbbell Bench Press", "confidence": "high" }
```
or `{ "match": null }` if nothing plausible exists — the model must pick from the supplied list or return null, not free-text.

Failure path: on API error or a `match` value not found verbatim in the supplied list, fall back to today's behavior exactly — line goes into `skipped`, nothing silently guessed.

Validation: the returned `match` string must be checked against the real `BUILT_IN_EXERCISES`/`customExercises` array before it's used for anything — treat any non-matching return as a fabrication and discard it, same as a failure.

Build size: ~3-4 hours (one API route, one small prompt, wire into the existing `skipped`-line loop).

User-visible value: medium, coach-only. Doesn't change what athletes see; saves the coach a manual fix-up pass after every bulk paste.

---

### 2. Individualized program drafting (replace the copy-to-claude.ai workflow)

Where: `app/coach/page.tsx:763-786` (`buildPrompt`), triggered from the "Claude" button at `app/coach/page.tsx:1355`

Today: `buildPrompt()` assembles a real, well-constructed snapshot (velocity, arm-care target, CMJ, classification, recent logs, the full Training Principles doc) into a text prompt, copies it to the clipboard, and opens claude.ai in a new tab for the coach to paste into and read the answer from — then manually re-type or re-copy whatever program the model suggests back into this app's own program builder. The data assembly is already done; only the round-trip is manual.

With a model: call the API directly from an API route using the exact same assembled context, and return a structured weekly program the UI can render as a normal editable draft (same shape as `structured_days`) instead of a wall of prose the coach has to hand-transcribe.

Input: everything `buildPrompt()` already assembles (velocity, foot-lb target, CMJ, classification, recommendation rule, last 7 session logs, full Training Principles text) plus the exact valid category list and the full exercise library (names + `id` + `pattern` + `cns`), so the model is choosing from real options, not inventing them.

Output shape:
```json
{
  "days": {
    "Monday": {
      "Throwing": [{ "exercise_id": "td_003", "sets": 3, "reps": 5, "load": "70" }],
      "Main Exercises": [{ "exercise_id": "ex_012", "sets": 4, "reps": 6, "load": "80" }]
    }
  },
  "rationale": "one sentence per day on why"
}
```

Failure path: on API failure, fall back to exactly today's behavior — copy the prompt, open claude.ai. Nothing about the current manual path gets removed, only supplemented.

Validation: every `exercise_id` must exist in `BUILT_IN_EXERCISES`/`customExercises`; every category key must be one of the 7 valid categories (`CATEGORY_ORDER`); `sets`/`reps` must be positive integers; `load` (if present) numeric 0-100. Reject the whole day's block if any single exercise fails validation rather than silently dropping just that line — this is a program a real pitcher trains from, not a best-effort suggestion list. Render the draft into the existing program builder UI as an editable, unsaved draft — the coach still reviews and hits Save; nothing writes to `programs` without that explicit action.

Build size: ~2-3 days (API route, structured-output prompt with the full exercise/category enum, draft-review UI reusing the existing program-builder components, the validation gate above).

User-visible value: high, coach-only directly — but every pitcher's program is downstream of this, so the real value is indirect and large. This is the single highest-leverage integration point in the app because it's the one place a human is already doing exactly this synthesis by hand, today, with a worse tool (a second browser tab).

---

### 3. Individualized Pitching IQ / Timing IQ insight text

Where: `app/components/PitchingIQ.tsx:247-253` (the `insight` callout: `` `vs ${bats}HH...: ${best.pitch_type} generates the highest chase rate...` ``) and `scripts/score_all_pitches.py`'s `FEATURE_EXPLANATIONS` dict + template sentence (`Most influential factor: {explanation} ({direction} than typical for this matchup).`), which is what actually populates Timing IQ's per-pitch "Why" column in production.

Today: both are string templates with blanks filled in from the top-ranked stat. They read as a real insight on first glance but are the same sentence shape every time, and they only ever surface the single top-ranked feature/metric — never a genuine synthesis across multiple signals (e.g. "this pitch's location deviation from the at-bat AND this pitcher's release-point drift both point the same direction" never gets said, because the template only has one blank to fill).

With a model: for a specific pitcher+scope selection (not per-pitch — see caching note below), send the actual computed stats (chase rates, whiff rates by pitch type, zone breakdown) and ask for a short, specific paragraph that can reference more than one number and their interaction, rather than a single-variable mad-lib.

Input: the same aggregate numbers already computed client-side for the view in question (chase list, pitch ranks, zone data) — no raw pitch-level data needs to leave the server for this one.

Output shape: plain prose, 2-4 sentences, no JSON needed — this is display-only text, nothing gets written back to the DB from it.

Failure path: on API failure or timeout, fall back to exactly today's template sentence — it already exists and is harmless; this proposal supplements it, doesn't require removing it.

Validation: none needed for DB safety (nothing is written), but do sanity-check the response isn't empty/absurdly long before rendering, and strip anything that looks like it's inventing a stat number that isn't in the input (a numeric hallucination here would look authoritative and be wrong).

Build size: ~1 day for the Pitching IQ tab version; the Timing IQ per-pitch version is a worse fit for this (see caching note) — recommend starting with Pitching IQ's per-pitcher/filter-combination insight only, not the per-pitch Timing IQ text.

User-visible value: medium, both coach and athlete (Pitching IQ) — low priority for Timing IQ specifically because of the caching problem below.

Caching note: Pitching IQ's insight is scoped to a filter combination (batter hand, arm angle, pitch, metric) that changes rarely and only with new Statcast data — cache per filter-combination, invalidate when the underlying aggregate tables refresh (same cadence as the existing cron). Timing IQ's per-pitch "Why" is the wrong place for a live model call at all — there are ~29,000 rows already scored by the batch pipeline; regenerating explanatory prose per pitch on page load would be slow and expensive for a column most users skim past. If this is pursued, generate it once as a batch step alongside `score_all_pitches.py`, not per page view.

---

### 4. Free-text notes fields that are stored and never read back

Where: `session_logs.notes` (written `app/pitcher/page.tsx:236`, displayed only inline in that pitcher's own recent-sessions list), `arm_care_tests.notes` (written `app/coach/page.tsx:443`), `cmj_results.notes` (written `app/pitcher/page.tsx:317`).

Today: every one of these is a free-text field an athlete or coach fills in ("shoulder felt tight in the 5th," "grip was off on this test") that is stored and displayed back verbatim on that single record — nothing ever aggregates it, searches it, or connects it to anything else. A coach with 19 pitchers logging session notes weekly has no way to see "who mentioned shoulder tightness in the last 2 weeks" without reading every log individually.

With a model: a coach-facing digest that reads recent notes across the roster (or one pitcher's history) and surfaces recurring themes/flags — not replacing the raw notes, which should stay visible, but adding a "things mentioned recently" summary layer on top.

Input: the raw `notes` text from `session_logs`/`arm_care_tests`/`cmj_results` for a given pitcher or date range — this is exactly the kind of unstructured-text-to-structured-signal task a model is suited for and deterministic code is not.

Output shape:
```json
{ "themes": [{ "topic": "shoulder tightness", "mentions": 3, "dates": ["2026-09-01","2026-09-04"], "severity_note": "escalating language across mentions" }] }
```

Failure path: on API failure, show nothing extra — the raw notes list (today's actual behavior) is always available underneath and unaffected.

Validation: this is read-only/display-only, nothing writes to the DB from it — the main risk is a false-negative (missing a real flag) or false-positive (crying wolf), not data corruption. Treat it as informational, never as the sole trigger for a workload/arm-care decision the app already makes deterministically elsewhere.

Build size: ~1-2 days (one API route, a coach-side digest panel, no schema changes since it only reads existing `notes` columns).

User-visible value: medium, coach-only. Real value scales with roster size — most useful for a coach managing many pitchers who can't re-read every log by hand every week.

---

### 5. Athlete-facing weekly digest tying trends together

Where: would live on `app/pitcher/page.tsx`'s Overview tab, alongside `ProgressOverview` (`app/components/ProgressOverview.tsx`) and the Workload Trend card already there.

Today: an athlete sees separate charts — velocity vs. CMJ ceiling, arm-care trend sparklines, workload trend, 7-day fuel score — with no narrative connecting them. Whether this week's velocity dip lines up with reduced sleep-adjacent fuel scores, or a workload spike, or nothing at all, is a cross-chart read the athlete has to do themselves, and most won't.

With a model: a short weekly paragraph generated from the same aggregate numbers already computed for these charts (nothing new to calculate) — "your velocity held steady this week even though workload was up 20% — arm care numbers are stable, keep going" or similar.

Input: the same week-over-week deltas already computed for the existing trend cards (CMJ, arm care flags, workload, fuel score) — no raw data leaves the server that isn't already being aggregated for display today.

Output shape: plain prose, 2-3 sentences.

Failure path: on API failure, just don't show the digest — the individual charts underneath are unaffected and are the real source of truth regardless.

Validation: read-only/display-only, nothing written to the DB. Same numeric-hallucination check as opportunity 3 — verify any number mentioned in the prose actually appears in the input data before rendering, or better, have the model reference the numbers by placeholder and interpolate them from the real data server-side rather than letting the model retype numbers itself.

Build size: ~1 day, contingent on caching (see below).

User-visible value: high, athlete-only — this is the most direct answer to "why does this app matter to me specifically" of anything on this list, precisely because it's synthesizing data the athlete already has access to but wouldn't cross-reference themselves.

Caching note: this changes at most once per new data point (a new session log, CMJ test, or fuel entry) — cache per pitcher per week, regenerate only when new data lands for that pitcher, not on every page load.

---

## Top 3 by value-to-effort ratio

1. **#2 — Individualized program drafting.** Highest absolute value because it's downstream of every pitcher's actual training, and it's replacing a manual process (copy/paste to a separate tab) that already exists and is already worse than an in-app version would be — this isn't "adding AI," it's finishing a workflow that's already half-built.
2. **#1 — Fuzzy exercise-name matching.** Cheapest build on this list (~half a day) with a clean, bounded validation story (model picks from a fixed list or says null — there's no way for it to write something wrong), and it removes a real, recurring manual-fixup step for the coach.
3. **#5 — Athlete-facing weekly digest.** Cheap to build because all the underlying numbers are already computed for existing charts; this is the one item on the list that's more athlete-value than coach-value, which matters given the stated goal of pitchers feeling the software is working *for* them specifically.

## Where NOT to use a model

- **The Predicted Velocity Ceiling diagnostic** (under-performing vs. over-performing the CMJ-predicted model — see `principles.content`, "PREDICTED VELOCITY CEILING") has a clean, fully-specified deterministic rule already written out by the coach: compare actual velocity to predicted, threshold-classify. This should be plain code, not a model call — it's free, instant, always consistent, and has a genuinely correct answer given the two input numbers. (Note: as of this audit it also isn't implemented as code OR called through a model — it's prose only. Worth building as deterministic logic regardless of any AI work.)
- **Category/exercise validation itself** (checking a proposed category is one of the 7 valid ones, an exercise ID exists in the library) must never be delegated to a model's judgment — this is exactly what the "Validation" step in every proposal above does with plain code, and it's non-negotiable precedent: a model *proposes*, code *validates*, only validated data ever reaches `programs`/`structured_days`.
- **The arm-care foot-lb formula, CMJ velocity formula, and recommendation-rule thresholds** are deterministic sports-science formulas with real (if unvalidated-in-the-tune-over-time sense) coefficients behind them — running these through a model instead of the existing arithmetic would trade a reproducible number for a non-reproducible one, for no benefit. Keep these as code; a model summarizing their *output* in prose (opportunity #3/#5) is fine, a model computing the number itself is not.
- **RLS/permission decisions** (who can read/write which row) must stay in Postgres policies, never in application-layer model judgment — this is a security boundary, not a content-quality one.
