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
1. ~~Calendar / week-to-week program history~~ -- built, see "Load-accounting rebuild" below (pending migration)
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

**Migration status: UNCONFIRMED.** The last handoff on this didn't
resolve whether it committed or errored -- do not assume either. Before
touching anything else, run this check and read the real answer off it:

```
select column_name from information_schema.columns
where table_name = 'programs' and column_name = 'carried_forward';
```

Column exists -> migration landed. No rows -> it did not (and `week_of`
values will still be pre-migration/stale, e.g. `2026-07-20` not a
recent Monday -- confirmed stale as of the pause point, pitcher Adrian
Pineda `9388833f-08de-4409-a7c9-d36d64a2b12a`).

**Not yet verified live** (blocked on the migration question above):
1. All 18 `programs` rows land on this Monday, still one row per pitcher.
2. Adding an exercise and saving updates the current-week row -- does
   not insert a second row for the same pitcher+week.
3. Past-week edit affordances are blocked at the handler level (not
   just visually hidden) -- AND a refused edit never repaints local
   state (the isCurrentWeek-guard-ordering fix needs to actually be
   observed working, not just read as correct in the diff).
4. An untouched, carried-forward pitcher shows the carried-forward
   banner in the coach UI and the constraints block tags that week
   `[carried_forward_untouched]`.

Point 4 needs a deliberate test, not passive waiting -- real pitchers
were all collapsed to one row each by the backfill, so nothing will
naturally hit the carried-forward path until next Monday. Planned
approach (not started, no rows touched yet): use pitcher **Adrian
Pineda** (`9388833f-08de-4409-a7c9-d36d64a2b12a`, chosen as lowest-cost
if something goes wrong) --
1. Back up his current `programs` row to a file (not just chat --
   confirmed this needs to survive a session boundary).
2. Insert a synthetic row at last Monday (his current content, as a
   stand-in "previous week").
3. Re-stamp (not delete) his real current-week row to NEXT Monday, to
   empty the current week without destroying data -- check first that
   no row already exists there (unique constraint).
4. Select him in the coach UI, verify rollover fires: banner, excluded
   tag, `created_via: 'rollover'`.
5. Delete the two synthetic rows, re-stamp his real row back to this
   Monday.
6. Confirm his row is byte-identical to the step-1 backup.

**Next after verification: Step F** -- wire the structural validation
rules (`lib/engine/*`: deprecated/equipment/gate/throwing-intent/CNS-
adjacency checks) into `confirmAddExercise`, the exercise-picker "Add"
flow. Confirmed this session: those rules currently run ONLY inside
`parseAndImportProgram` (bulk paste-import) -- the picker path, which is
the primary way exercises actually get added, has zero validation today.

**Remaining steps after F**, in the order already agreed: A/C (ledger
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

## Key decisions made:
- Categories: Pre-Throwing, Throwing, Post-Throwing, Main Exercises, Accessory, Conditioning, Recovery
- Macro split: 40% protein / 30% carbs / 30% fat
- CMJ thresholds based on Salzman database (not generic sports science)
- Food scoring: Macros 30pts, Quality 30pts, Glycemic 20pts, Timing 20pts
- No Anthropic API usage (free approach only)
- VS Code installed for editing
- All number inputs use type=text inputMode=numeric for mobile
