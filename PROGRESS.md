# Salzman Baseball - Progress Notes

## Live URLs:
- Coach: https://salzman-baseball.vercel.app/coach
- Pitcher: https://salzman-baseball.vercel.app/pitcher
- Public CMJ: https://salzman-baseball.vercel.app/cmj
- GitHub: https://github.com/929davis/salzman-baseball
- Supabase: https://supabase.com/dashboard/project/bpeiaeivxdqoujbakbrw

## Supabase Tables:
profiles, programs, session_logs, cmj_results, squat_jump_results,
single_leg_cmj_results, triple_hop_results, plyo_pushup_results,
coach_notes, messages, principles, exercise_videos, custom_exercises,
exercise_overrides, recommendation_rules, food_logs, daily_fuel_scores,
public_cmj_submissions

## Still to build:
1. ~~Calendar / week-to-week program history~~ -- built and migration applied, see "Load-accounting rebuild" below
2. Coach view of all assessment data per pitcher
3. Player development profile on coach side
4. Public CMJ submissions view on coach dashboard
5. Exercise audit (fix wrong categories/CNS on built-in exercises)

## In progress: load-accounting rebuild (paused mid-session)

Governing principle: the written program is the load of record. Logs
confirm or revise prescribed load; they never create it.

**Committed locally, NOT pushed** (latest: `c869db7`):
- Step D -- fixed two constraints-block bugs: unresolvable CNS ceiling
  violation, narrative prose that could contradict the athlete's real state.
- Step B -- provenance tagging + asymmetric resolution
  (`lib/engine/provenance.ts`): LOAD/EXPOSURE fields resolve by MAX
  across sources, CAPABILITY fields resolve by precedence
  (coach_asserted > logged > inferred).
- Dated program history -- one `programs` row per (pitcher_id, week_of),
  `carried_forward`/`first_edited_at`/`created_via` tracking, week
  navigation UI, four call sites fixed to fetch THIS WEEK explicitly
  (never "latest"), local-state-phantom-edit fix (isCurrentWeek guard
  moved ahead of setStructuredDays/setCellNotes in all four edit
  functions).
- Migration file: `sql/programs_dated_history.sql` (BEGIN/COMMIT-wrapped,
  all-or-nothing).

**Migration APPLIED to live Supabase, verified.** All 19 rows (not 18 --
the pre-migration count was off by one) landed at `2026-09-14`,
`carried_forward=false`, `first_edited_at` populated, `created_via='direct'`.
Identical timestamps across all 19 confirm the single transaction committed
atomically.

**Verified live:**
1. Row count/uniqueness: 19 rows, one per pitcher, all at the current Monday.
2. Adding an exercise and saving updates the current-week row -- does not
   insert a second row for the same pitcher+week.
3. Past-week edit blocked with an alert and no repaint (the isCurrentWeek-
   guard-ordering fix confirmed working live, not just correct in the diff).

**Not yet verified -- point 4, carried-forward banner/exclusion tag:**
NOT started, no rows touched. The carried-forward trigger path
(`loadProgramForWeek`'s copy-forward branch) has zero automated test
coverage and cannot be exercised live right now -- the backfill collapsed
every pitcher to exactly one row each (this current week), so no pitcher
has an empty current week for the rollover to fire against. Earliest
natural occurrence: next Monday. Designed, reversible alternative to test
it sooner (not started, no rows touched):
1. Back up the target pitcher's current `programs` row to a file (not just
   chat -- needs to survive a session boundary).
2. Insert a synthetic row at last Monday (their current content, as a
   stand-in "previous week").
3. Re-stamp (not delete) their real current-week row to NEXT Monday, to
   empty the current week without destroying data -- check first that no
   row already exists there (unique constraint now enforces this).
4. Select them in the coach UI, verify rollover fires: banner, excluded
   tag, `created_via: 'rollover'`.
5. Delete the two synthetic rows, re-stamp their real row back to this
   Monday.
6. Confirm their row is byte-identical to the step-1 backup.
Candidate pitcher discussed: Adrian Pineda (`9388833f-08de-4409-a7c9-d36d64a2b12a`).

**Step F -- DONE (partial scope; committed locally, not pushed, `0bbc79c`).**
`confirmAddExercise` (the exercise-picker "Add" flow) now fetches
athlete_state fresh and runs checkDeprecated/checkEquipmentTier/
checkGateRequirement/checkThrowingIntent before saving, same as
`parseAndImportProgram` already did for bulk paste-import. Blocks the
save and shows the reason inline (in plain language, via
`humanizeReason` -- see below) on failure. Confirm-time blocking only,
by explicit scope decision -- no list-level graying, `filteredExercises`
untouched. **Not included: checkCNSAdjacency.** That's a week-level
check (two high-CNS days back to back), not a per-slot one, and still
only runs inside `parseAndImportProgram` as an advisory warning over
the whole merged week -- the picker path has no CNS-adjacency check at
all. Worth a decision later on whether/how to surface that on a
single-exercise add.

**Also done, adjacent to the above (separate request, same session):**
a plain-language rendering layer (`lib/plainLanguage.ts`:
intentLabel/gateLabel/stageLabel/tierLabel, all `{plain, code}`) --
coach-side UI shows plain label as primary text with the raw code as a
secondary tag/tooltip (AthleteStatePanel, Program tab grid, ThrowLogPanel,
and now the picker's validation-failure messages); pitcher-side strips
codes entirely. Found and fixed a real bug in the process: the pitcher
program view only ever rendered `ex.sets`/`ex.reps`, so a Throwing slot
(count + intent_level, no sets/reps) rendered as literal
"undefined×undefined". The full constraints block (`renderAthleteConstraintsBlock`)
was deliberately left untranslated -- confirmed it's clipboard content
bound for Claude.ai, not a human-reading surface.

**Remaining steps**, in the order already agreed: A/C (ledger
persistence proper -- today's dated-history fix only gets MAX resolution
as far as the current week; 28-day chronic prescribed history still
needs the ledger) -> H (three-state gates: passed/failed/not_tested,
`athlete_gate_status` table, cheapest-unlocks queue) -> I (principles
routing table keyed on season_phase x throwing_status x gates_passed x
season_role; widen `principles_sections.doc` CHECK to add a third value
`'system'` for governance sections) -> E (deviation-only athlete
logging) -> G (coach assertions as first-class input, with the
red-flag/Restricted asymmetry: assertions can set, never clear) -> J
(new principles section, numbered 0.1-0.6, covering all of the above).

**Open note for Step C, not acted on yet:** a rollover week edited once
is indistinguishable from a fully written week in the constraints block
-- same thin-plan problem as the copy-created-row case (`created_via:
'copy'`), one step removed. A single touched slot on a carried-forward
week clears the exclusion entirely and reads as a complete plan. Worth
solving when the ledger (ratcheting the same fix that gave `created_via`
provenance) gets built in Step C.

## Key decisions made:
- Categories: Pre-Throwing, Throwing, Post-Throwing, Main Exercises, Accessory, Conditioning, Recovery
- Macro split: 40% protein / 30% carbs / 30% fat
- CMJ thresholds based on Salzman database (not generic sports science)
- Food scoring: Macros 30pts, Quality 30pts, Glycemic 20pts, Timing 20pts
- No Anthropic API usage (free approach only)
- VS Code installed for editing
- All number inputs use type=text inputMode=numeric for mobile
