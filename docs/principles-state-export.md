# Principles State Export

Raw snapshot of current state. Export only — no interpretation, no recommendations, no fixes.

---

## 1. `principles_sections` — full dump

106 rows. Sorted by `doc` then `section_number`. Body text omitted (char count only).

| doc | section_number | title | tags | is_engine_rule | always_include | sort_order | char_count |
|---|---|---|---|---|---|---|---|
| strength | 1.1 | Movement analysis of pitching | background | False | False | 10 | 1176 |
| strength | 1.2 | The two functional columns | background | True | False | 20 | 2542 |
| strength | 1.3 | Physiological analysis — ranked for pitching | background | True | False | 30 | 1309 |
| strength | 1.4 | Energy system analysis | conditioning | False | False | 40 | 2102 |
| strength | 1.5 | Injury analysis | background | False | False | 50 | 1312 |
| strength | 1.6 | Evaluation of the athlete | background | False | False | 60 | 533 |
| strength | 2.1 | Test selection criteria | testing | False | False | 70 | 384 |
| strength | 2.2 | Benchmarks | testing | False | False | 80 | 2770 |
| strength | 2.3 | Countermovement jump — the full model | testing | True | False | 90 | 5240 |
| strength | 2.4 | The Physical/Performance Gap | testing | True | False | 100 | 839 |
| strength | 2.5 | Asymmetry thresholds | testing | True | False | 110 | 656 |
| strength | 2.6 | Shoulder rotation — separate criteria | arm_care, testing | True | False | 120 | 1112 |
| strength | 2.7 | Retest schedule | testing | True | False | 130 | 2777 |
| strength | 3.1 | Training status | athlete_setup | False | True | 140 | 536 |
| strength | 3.2 | Equipment tier | athlete_setup | True | True | 150 | 733 |
| strength | 3.3 | Readiness gates | athlete_setup | True | True | 160 | 1531 |
| strength | 4.1 | Prescription language: RPE first | lifting | False | False | 170 | 335 |
| strength | 4.2 | The load table | lifting | True | True | 180 | 928 |
| strength | 4.3 | Load by exercise class | lifting | True | True | 190 | 589 |
| strength | 4.4 | Olympic lifts — removed | lifting | False | False | 200 | 1558 |
| strength | 4.5 | Exercise selection and order | lifting | True | True | 210 | 1214 |
| strength | 4.6 | Frequency — the CNS budget | lifting | True | True | 220 | 977 |
| strength | 4.7 | One primary quality per phase | lifting | True | True | 230 | 288 |
| strength | 4.8 | Progression, deload, and regression | deload | True | True | 240 | 1824 |
| strength | 5.1 | Hierarchy | background | False | False | 250 | 457 |
| strength | 5.2 | The governing theory | background | True | True | 260 | 1384 |
| strength | 5.3 | The college baseball annual plan | calendar, off_season | True | False | 270 | 1301 |
| strength | 5.4 | Phase prescriptions | off_season | True | False | 280 | 644 |
| strength | 5.5 | Non-linear structure for advanced athletes | off_season | True | False | 290 | 479 |
| strength | 5.6 | In-season — managing the team lift | in_season | True | False | 300 | 1048 |
| strength | 6.1 | Eccentric training | lifting | True | False | 310 | 1217 |
| strength | 6.2 | Isometric training | lifting | True | False | 320 | 1036 |
| strength | 6.3 | Ballistic training | lifting | True | False | 330 | 460 |
| strength | 6.4 | Plyometric training | lifting | True | False | 340 | 1369 |
| strength | 6.5 | KEAT and shock training | lifting, off_season | True | False | 350 | 2054 |
| strength | 6.6 | Weighted implement throwing | off_season, throwing, velocity_block | True | False | 360 | 1715 |
| strength | 6.7 | Rotational work | lifting | True | False | 370 | 839 |
| strength | 7.1 | Prescription by energy system | conditioning | True | False | 380 | 1413 |
| strength | 7.2 | Seasonal conditioning | conditioning | False | False | 390 | 282 |
| strength | 8.1 | The governing principle | recovery | False | False | 400 | 307 |
| strength | 8.2 | Sleep | recovery | False | False | 410 | 542 |
| strength | 8.3 | Recovery modalities | recovery | False | False | 420 | 397 |
| strength | 8.4 | Arm care volume — the computable formula | arm_care, recovery | True | True | 430 | 4560 |
| strength | 9.1 | Template structure | templates | True | True | 440 | 1592 |
| strength | 9.2 | Movement category library | lifting, templates | False | False | 450 | 2024 |
| strength | 9.3 | Off-season week — general preparatory | off_season, templates | False | False | 460 | 596 |
| strength | 9.4 | Off-season week — specific preparatory | off_season, templates | False | False | 470 | 543 |
| strength | 9.5 | Off-season week — first transition (power / KEAT block) | off_season, templates | False | False | 480 | 790 |
| strength | 9.6 | In-season week — athlete with a team lift (starter) | in_season, templates | False | False | 490 | 755 |
| strength | 9.7 | In-season week — athlete with no team lift (starter) | in_season, templates | False | False | 500 | 544 |
| strength | 9.8 | Deload week | deload, templates | False | False | 510 | 451 |
| throwing | 10.1 | Delivery phases | background | False | False | 520 | 1803 |
| throwing | 10.2 | What is trainable and what is individual | movement_change | True | False | 530 | 1322 |
| throwing | 11.1 | Assessment inputs | testing | False | False | 540 | 562 |
| throwing | 11.2 | Video capture standard | testing | True | False | 550 | 985 |
| throwing | 11.3 | What 2D video can and cannot measure | testing | True | False | 560 | 1606 |
| throwing | 11.4 | Assessment output | testing | False | False | 570 | 434 |
| throwing | 12.1 | Intent scale | athlete_setup, throwing | True | True | 580 | 844 |
| throwing | 12.1a | What reduced effort actually delivers — and why it changes the volume math | athlete_setup | False | True | 590 | 1729 |
| throwing | 12.2 | Throwing status | athlete_setup, throwing | False | True | 600 | 274 |
| throwing | 12.3 | Gates — what has to be true before a guy is allowed to do something | athlete_setup, throwing | False | True | 610 | 1130 |
| throwing | 13.1 | The default method | background, movement_change | True | False | 620 | 568 |
| throwing | 13.2 | Model selection | movement_change | True | False | 630 | 1014 |
| throwing | 13.3 | Cue construction — external over internal | movement_change | True | False | 640 | 1879 |
| throwing | 13.4 | Feedback frequency | movement_change | True | False | 650 | 1249 |
| throwing | 13.5 | The four stages of a change | movement_change | True | False | 660 | 2241 |
| throwing | 13.6 | Advancement criteria | movement_change | True | False | 670 | 885 |
| throwing | 13.7 | One change at a time — hard rule | movement_change | True | True | 680 | 737 |
| throwing | 13.8 | Intent and movement change | movement_change | True | False | 690 | 624 |
| throwing | 13.9 | Constraints — the secondary tool | movement_change | False | False | 700 | 1272 |
| throwing | 13.10 | Positional development sequence | movement_change | False | False | 710 | 476 |
| throwing | 14.1 | Direction and structure | throwing | False | False | 720 | 485 |
| throwing | 14.2 | The phases are layers, not a ladder | movement_change, throwing | True | False | 730 | 6427 |
| throwing | 14.3 | Problem-based routing | throwing | True | False | 740 | 550 |
| throwing | 14.4 | Session flow | throwing | False | False | 750 | 300 |
| throwing | 14.5 | Long toss | throwing | True | False | 760 | 883 |
| throwing | 14.6 | Velocity development — what actually drives it | off_season, throwing, velocity_block | True | False | 770 | 1320 |
| throwing | 14.7 | Constrained positions do not reduce arm stress | throwing | True | True | 780 | 1509 |
| throwing | 14.8 | Dry reps | throwing | True | False | 790 | 917 |
| throwing | 14.9 | Med ball work in the throwing program | throwing | True | False | 800 | 751 |
| throwing | 14.10 | Prescribing velocity work intelligently | off_season, throwing, velocity_block | True | False | 810 | 1885 |
| throwing | 15.1 | The variables | throwing | False | False | 820 | 301 |
| throwing | 15.2 | Arm load accounting | throwing | True | True | 830 | 670 |
| throwing | 15.2a | Where the weekly budget comes from — and why it isn't a number | throwing | False | True | 840 | 1997 |
| throwing | 15.3 | Intent distribution | throwing | False | False | 850 | 255 |
| throwing | 15.4 | Distance | throwing | False | False | 860 | 289 |
| throwing | 15.5 | Frequency and recovery interval | throwing | False | False | 870 | 575 |
| throwing | 15.5a | Where high-intent long toss goes | throwing | True | False | 880 | 1181 |
| throwing | 16.1 | Annual structure | calendar, off_season | True | False | 890 | 1478 |
| throwing | 16.2 | The shutdown is not optional | calendar | False | False | 900 | 296 |
| throwing | 16.3 | Summer ball | calendar | False | False | 910 | 500 |
| throwing | 16.4 | Movement change and the calendar | calendar, in_season, off_season | True | False | 920 | 815 |
| throwing | 17.1 | In-game and post-game routing | diagnostics | True | False | 930 | 6513 |
| throwing | 17.2 | Red flags — stop throwing | arm_care, diagnostics | True | True | 940 | 554 |
| throwing | 17.3 | The soreness distinction | arm_care, diagnostics | False | False | 950 | 616 |
| throwing | 18.1 | The graded exposure model | return_to_throw | False | False | 960 | 876 |
| throwing | 18.2 | The four phases | return_to_throw | False | False | 970 | 899 |
| throwing | 18.3 | Why effort percentages cannot control the dose | return_to_throw | True | False | 980 | 1269 |
| throwing | 18.4 | Parasympathetic pairing — methods | return_to_throw | False | False | 990 | 1473 |
| throwing | 18.5 | Reintegration with the rest of the system | return_to_throw | False | False | 1000 | 446 |
| throwing | 19.1 | Structure | templates | True | True | 1010 | 1343 |
| throwing | 19.2 | Movement block session — off-season | off_season, templates | False | False | 1020 | 535 |
| throwing | 19.3 | Mixed practice session — off-season | off_season, templates | False | False | 1030 | 500 |
| throwing | 19.4 | Velocity session — first transition only | off_season, templates, velocity_block | False | False | 1040 | 603 |
| throwing | 19.5 | In-season week — starter | in_season, templates | False | False | 1050 | 520 |
| throwing | 19.6 | Restricted session — §18 Retraining phase | return_to_throw, templates | False | False | 1060 | 657 |
---

## 2. `lib/engine/` — full contents

Every file in `lib/engine/`, file name and complete source, so it's clear what's already built as real code versus what's still only prose in `principles_sections`.

### `lib/engine/athleteConstraints.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { computeAthleteConstraints, renderAthleteConstraintsBlock } from './athleteConstraints'
import type { EngineExercise } from './types'

// Minimal thenable query-builder stub -- every chain method returns itself, and the object
// resolves (via `.then`, same as the real supabase-js query builder) to a canned response keyed
// by table name. Good enough for this file's pure data-in/data-out computation; no real
// Supabase call is made.
function fakeSupabase(responses: Record<string, { data: any, error: null }>) {
  return {
    from(table: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => chain,
        then: (resolve: any) => resolve(responses[table] ?? { data: null, error: null }),
      }
      return chain
    },
  } as any
}

const baseAthleteState = {
  training_status: 'intermediate', equipment_tier: 'E1', throwing_status: 'developing',
  season_phase: 'general_prep', season_role: 'starter', gates_passed: [],
  active_change: null, active_change_stage: null, has_team_lift: false, team_lift_heavy_day: null,
}

const emptyPool: EngineExercise[] = []

// The code under test parses throw_date as local midnight (`new Date(dateStr + 'T00:00:00')`)
// and compares against a local "now" -- so test fixtures must build dates the same way.
// `.toISOString()` is UTC and can land on a different calendar day than local "today" (it did,
// in this timezone, at the time these tests were first written), silently shifting every date
// by one and making throw entries look future-dated or misdated relative to `asOf`.
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n)
  return localDateStr(d)
}

describe('computeAthleteConstraints — high-CNS ceiling violation (bug 1)', () => {
  it('reports a violation with the failed rule and named removable candidates, not a silent number', async () => {
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null }, // general_prep -> ceiling 3
      programs: {
        data: {
          structured_days: {
            Monday___Lifting: [{ name: 'Trap Bar Deadlift', cns: 'High' }],
            Tuesday___Lifting: [{ name: 'Depth Jump', cns: 'High' }],
            Wednesday___Lifting: [{ name: 'Weighted Broad Jump', cns: 'High' }],
            Thursday___Lifting: [{ name: 'Barbell Back Squat', cns: 'High' }],
          },
        },
        error: null,
      },
      throw_log: { data: [], error: null },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    expect(c.weekly_high_cns_committed.value).toBe(4)
    expect(c.weekly_high_cns_ceiling).toBe(3)
    expect(c.weekly_high_cns_violation).not.toBeNull()
    expect(c.weekly_high_cns_violation!.excess).toBe(1)
    expect(c.weekly_high_cns_violation!.removeCandidates).toHaveLength(4)

    const block = renderAthleteConstraintsBlock(c)
    expect(block).toContain('RULE FAILED')
    expect(block).toContain('Nearest legal alternative')
  })

  it('reports no violation when committed days are at or under ceiling', async () => {
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null },
      programs: { data: { structured_days: { Monday___Lifting: [{ name: 'Trap Bar Deadlift', cns: 'High' }] } }, error: null },
      throw_log: { data: [], error: null },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    expect(c.weekly_high_cns_violation).toBeNull()
  })
})

describe('renderAthleteConstraintsBlock — facts only, no narrative prose (bug 2)', () => {
  it('never emits assumed-context narration that could contradict this athlete\'s real state', async () => {
    const supabase = fakeSupabase({
      // general_prep, NOT competitive -- the old prose specifically claimed "a
      // competitive-phase starter's ceiling is usually already mostly consumed" unconditionally.
      athlete_state: { data: { ...baseAthleteState, season_phase: 'general_prep', active_change: 'Front-side stability', active_change_stage: 2 }, error: null },
      programs: { data: { structured_days: {} }, error: null },
      throw_log: { data: [], error: null },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    const block = renderAthleteConstraintsBlock(c)
    expect(block.toLowerCase()).not.toContain('competitive-phase starter')
    expect(block.toLowerCase()).not.toContain('still acquiring the new movement shape')
    // The fact itself (the cap) must still be present -- only the narrated reason is gone.
    expect(block).toContain('Intent Cap: I3')
  })
})

describe('computeAthleteConstraints — asymmetric resolution', () => {
  it('carries prescribed load when it exceeds logged load (the case from the task brief)', async () => {
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null },
      // Program prescribes 80 throws this week (one bullpen, Monday); nothing close to that
      // was logged -- only 20 acute throws on record.
      programs: { data: { structured_days: { Monday___Throwing: [{ name: 'Bullpen', cns: 'Low', count: 80, intent_level: 'I3' }] } }, error: null },
      throw_log: { data: [{ throw_date: daysAgo(0), count: 20, implement: '5oz', intent_level: 'I3' }], error: null },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    expect(c.resolvedAcute7d.value).toBe(80)
    expect(c.resolvedAcute7d.source).toBe('prescribed')
    expect(c.throwLoad.acute7d).toBe(20) // the pure logged figure is untouched
  })

  it('changes nothing for an athlete who logs fully (logged already meets or exceeds prescribed)', async () => {
    const today = daysAgo(0)
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null },
      // Prescribed 80; this athlete actually logged 100 (did the work and then some).
      programs: { data: { structured_days: { Monday___Throwing: [{ name: 'Bullpen', cns: 'Low', count: 80, intent_level: 'I3' }] } }, error: null },
      throw_log: { data: [{ throw_date: today, count: 100, implement: '5oz', intent_level: 'I3' }], error: null },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    // The resolved figure is exactly what a logged-only computation would already have given --
    // a full logger sees identical numbers to before this change, just correctly tagged.
    expect(c.resolvedAcute7d.value).toBe(100)
    expect(c.resolvedAcute7d.source).toBe('logged')
    expect(c.throwLoad.acute7d).toBe(100)
    expect(c.ratioWithheldReason).toBeNull()
  })
})

describe('computeAthleteConstraints — copy-created row provenance', () => {
  it('counts a copy-created row honestly but flags it as a single-slot week, not a full program', async () => {
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null },
      programs: {
        data: {
          structured_days: { Tuesday___Lifting: [{ name: 'Depth Jump', cns: 'High' }] },
          carried_forward: false,
          first_edited_at: new Date().toISOString(),
          created_via: 'copy',
        },
        error: null,
      },
      throw_log: { data: [], error: null },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    // Counted honestly -- NOT excluded, unlike carried-forward-untouched.
    expect(c.weekProgramStatus).toBe('edited')
    expect(c.weekly_high_cns_committed.value).toBe(1)
    expect(c.weekly_high_cns_committed.source).toBe('prescribed')
    expect(c.weekSlotCount).toBe(1)
    expect(c.weekCreatedVia).toBe('copy')

    const block = renderAthleteConstraintsBlock(c)
    expect(block).toContain('[copy]')
    expect(block).toContain('NOT a full written program')
    expect(block).toContain('1 slot')
  })
})

describe('computeAthleteConstraints — carried-forward-untouched exclusion', () => {
  it('excludes a carried-forward, never-edited program from prescribed load entirely', async () => {
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null },
      // Copied forward from a previous week, never edited (first_edited_at null) -- even
      // though it has real content (80 prescribed throws, a high-CNS day), none of it may
      // count as this week's genuine prescribed load.
      programs: {
        data: {
          structured_days: {
            Monday___Throwing: [{ name: 'Bullpen', cns: 'Low', count: 80, intent_level: 'I4' }],
            Tuesday___Lifting: [{ name: 'Depth Jump', cns: 'High' }],
          },
          carried_forward: true,
          first_edited_at: null,
        },
        error: null,
      },
      throw_log: { data: [], error: null },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    expect(c.weekProgramStatus).toBe('carried_forward_untouched')
    expect(c.resolvedAcute7d.value).toBe(0)
    expect(c.resolvedAcute7d.source).toBe('logged') // nothing logged either -> resolveLoad's own fallback picks 'logged' side (0), not 'prescribed'
    expect(c.weekly_high_cns_committed.value).toBe(0)
    expect(c.weekly_high_cns_committed.source).toBe('carried_forward_untouched')
    expect(c.weekly_high_cns_violation).toBeNull()

    const block = renderAthleteConstraintsBlock(c)
    expect(block).toContain('carried_forward_untouched')
    expect(block).toContain('NOT counted as this week')
  })

  it('counts a carried-forward program once it has been edited', async () => {
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null },
      programs: {
        data: {
          structured_days: { Monday___Throwing: [{ name: 'Bullpen', cns: 'Low', count: 80, intent_level: 'I3' }] },
          carried_forward: true,
          first_edited_at: new Date().toISOString(), // the coach touched it
        },
        error: null,
      },
      throw_log: { data: [], error: null },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    expect(c.weekProgramStatus).toBe('edited')
    expect(c.resolvedAcute7d.value).toBe(80)
    expect(c.resolvedAcute7d.source).toBe('prescribed')
  })

  it('reports no_program (not a phantom zero) when no row exists for this week at all', async () => {
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null },
      programs: { data: null, error: null }, // .maybeSingle() with no matching row
      throw_log: { data: [], error: null },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    expect(c.weekProgramStatus).toBe('no_program')
    const block = renderAthleteConstraintsBlock(c)
    expect(block).toContain('no_program')
  })
})

describe('computeAthleteConstraints — ratio withheld on mismatched resolution', () => {
  it('withholds the acute:chronic ratio when acute resolved from prescribed data', async () => {
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null },
      programs: { data: { structured_days: { Monday___Throwing: [{ name: 'Bullpen', cns: 'Low', count: 80, intent_level: 'I3' }] } }, error: null },
      // 28+ days of light logging so hasEnoughHistory is true and a ratio COULD have been
      // printed if this test were only checking the old (pre-fix) gate.
      throw_log: {
        data: Array.from({ length: 30 }, (_, i) => ({
          throw_date: daysAgo(i),
          count: 10, implement: '5oz', intent_level: 'I2',
        })),
        error: null,
      },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    expect(c.resolvedAcute7d.source).toBe('prescribed') // 80 prescribed beats ~70 logged acute
    expect(c.ratioWithheldReason).not.toBeNull()
    const block = renderAthleteConstraintsBlock(c)
    expect(block).toContain('WITHHELD')
    expect(block).not.toMatch(/Acute:Chronic Ratio: \d/) // no numeric ratio printed
  })

  it('shows a normal ratio when acute resolves from logged data (both sides consistent)', async () => {
    const supabase = fakeSupabase({
      athlete_state: { data: baseAthleteState, error: null },
      programs: { data: { structured_days: {} }, error: null }, // nothing prescribed
      throw_log: {
        data: Array.from({ length: 30 }, (_, i) => ({
          throw_date: daysAgo(i),
          count: 20, implement: '5oz', intent_level: 'I2',
        })),
        error: null,
      },
      cmj_results: { data: [], error: null },
    })
    const c = await computeAthleteConstraints(supabase, 'p1', emptyPool)
    expect(c.resolvedAcute7d.source).toBe('logged')
    expect(c.ratioWithheldReason).toBeNull()
    const block = renderAthleteConstraintsBlock(c)
    expect(block).toMatch(/Acute:Chronic Ratio: \d/)
  })
})
```

### `lib/engine/athleteConstraints.ts`

```ts
// Computes the "facts about this athlete" block buildPrompt injects above the principles
// sections. Unlike every other file in lib/engine/, this one DOES talk to Supabase directly --
// it's a data-gathering + computation aggregator, not a pure validation rule, so it doesn't fit
// the (athleteState, slot) -> RuleResult shape the rest of this module uses. Kept here anyway
// because it's still "engine" logic: the same athlete_state/gate/equipment-tier concepts the
// validator uses, just assembled into a report instead of a pass/fail check.
//
// Governing principle (see principles doc section 0.x): the written program is the load of
// record. Logs confirm or revise prescribed load; they never create it. Every LOAD/EXPOSURE
// field below is resolved by MAX across prescribed+logged sources so a non-logger's real
// throwing never silently reads as rest. Every CAPABILITY field is resolved by precedence so a
// stale/lower-trust source can never override a higher-trust one. See lib/engine/provenance.ts.
//
// Scope note (Step B/A): full ledger-backed MAX resolution (Step C) doesn't exist yet -- so
// MAX resolution here only covers what's honestly derivable today: THIS WEEK's program row
// (fetched by exact week_of match, never "latest" -- see Step A, dated program history) vs.
// logged throw_log data in the trailing 7 days -- both genuinely describe "this week." The
// 28-day CHRONIC figure stays logged-only and is labeled as such until Step C's ledger gives
// it dated prescribed history too. Prescribed throwing slots also don't carry an implement tag
// today (structured_days has no implement field) -- prescribed weighted totals below assume
// the default 1.0 weight until a future step adds real implement tracking to the program
// schema.
//
// Carried-forward exclusion (Step A): a program row copied forward from a previous week and
// never edited since (carried_forward=true, first_edited_at=null) must NOT count toward
// prescribed load -- a pitcher who's stopped being actively programmed would otherwise accrue
// phantom prescribed load every week forever, the mirror image of the bug this file exists to
// fix. weekProgramStatus surfaces this explicitly rather than silently zeroing it out.
//
// Deliberately does NOT read or restate any principles content -- only computed values from
// athlete_state, throw_log, cmj_results, and the exercise library.
import type { SupabaseClient } from '@supabase/supabase-js'
import { EngineAthleteState, EngineExercise, Gate, EquipmentTier } from './types'
import { resolveRequiredGate } from './gateRequirement'
import { meetsEquipmentTier } from './equipmentGate'
import { classifyCMJ } from '../cmj'
import { computeThrowLoadRatio, type ThrowLoadResult } from '../throwLog'
import { type Source, type Sourced, sourced, resolveLoad, resolveCapability, tag } from './provenance'
import { currentWeekOf } from '../weekUtils'

const ALL_GATES: Gate[] = ['G1', 'G2', 'G3', 'G4', 'T1', 'T2', 'T3', 'T4']
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Weekly high-CNS ceiling -- derived from season_phase, not a stored column. Every prep phase
// (more room to build) gets 3; competitive (in-season, throwing/game load already consuming
// recovery capacity) gets 2. Unrecognized/null phase stays null -- no silent default.
function deriveWeeklyHighCNSCeiling(seasonPhase: string | null): number | null {
  if (seasonPhase == null) return null
  if (['transition', 'general_prep', 'specific_prep', 'first_transition'].includes(seasonPhase)) return 3
  if (seasonPhase === 'competitive') return 2
  return null
}

// Stage -> intent cap for the one in-flight mechanical change athlete_state tracks. The WHY
// (rationale sentence) used to be concatenated into the rendered line -- moved to a lookup the
// principles doc explains once, not restated per-prompt (see item 10: facts only, no prose that
// can drift from context).
const STAGE_INTENT_CAP: Record<number, string> = { 1: 'I2', 2: 'I3', 3: 'I4', 4: 'I5' }

export type GateBlock = { gate: Gate, blocks: string[] }
export type ExcludedCategory = { category: string, reason: string }

// One High-CNS commitment in the current program -- day + which specific exercise is tagged
// CNS:'High'. Surfaced so a ceiling violation names removable candidates instead of just a
// bare "over ceiling" count (item 10, bug 1: never report a violation with no resolution path).
export type HighCNSExposure = { day: string, exerciseName: string, category: string }

export type WeeklyHighCNSViolation = {
  excess: number // how many exposures need to come out to be back at/under ceiling
  removeCandidates: HighCNSExposure[] // every current exposure, most-recently-added last
}

// A plain fact about the row itself, not a Sourced<T> -- there's nothing to resolve between
// multiple sources here, it's a direct read of this week's programs row (or its absence).
// Drives whether prescribed candidates are included in any resolveLoad call below.
export type WeekProgramStatus = 'edited' | 'carried_forward_untouched' | 'no_program'

export type AthleteConstraints = {
  pitcherId: string
  athleteStateFound: boolean
  weekOf: string
  weekProgramStatus: WeekProgramStatus
  weekCreatedVia: 'direct' | 'rollover' | 'copy' | null
  weekSlotCount: number
  training_status: Sourced<string | null>
  equipment_tier: Sourced<EquipmentTier | null>
  throwing_status: Sourced<string | null>
  season_phase: Sourced<string | null>
  season_role: Sourced<string | null>
  gates_passed: string[]
  gates_not_passed: GateBlock[]
  allowed_movement_categories: string[]
  excluded_movement_categories: ExcludedCategory[]
  weekly_high_cns_committed: Sourced<number>
  // Derived from season_phase (see deriveWeeklyHighCNSCeiling). null only when season_phase
  // itself is null/unrecognized -- not a missing definition anymore.
  weekly_high_cns_ceiling: number | null
  weekly_high_cns_violation: WeeklyHighCNSViolation | null
  has_team_lift: boolean
  team_lift_heavy_day: string | null
  // throwLoad is the PURE logged computation, untouched -- acute7d/chronicWeeklyAvg28d/ratio/
  // band/hasEnoughHistory exactly as lib/throwLog.ts computes them from throw_log alone.
  // resolvedAcute7d is the MAX-resolved figure (logged vs. this week's prescribed Throwing
  // slots) -- the one to actually reason about "how much has this pitcher thrown this week."
  // ratioWithheldReason is non-null whenever resolvedAcute7d didn't come from 'logged' -- an
  // acute figure boosted by prescribed data over a chronic denominator that's still
  // logged-only would inflate the ratio in the conservative direction, which still trains a
  // coach to ignore real warnings. See item 2 of the review that added this field.
  throwLoad: ThrowLoadResult
  resolvedAcute7d: Sourced<number>
  ratioWithheldReason: string | null
  weekly_i4_i5_count: Sourced<number>
  active_change: Sourced<string | null>
  active_change_stage: Sourced<number | null>
  // Derived from active_change_stage (see STAGE_INTENT_CAP). null only when there's no active
  // change, or the stage value is missing/outside 1-4.
  active_change_intent_cap: string | null
  days_since_high_intent_throwing: number | null
  cmj_classification: Sourced<string | null>
  // Every field name here is one this function could NOT determine -- either athlete_state is
  // missing entirely, or a specific column on it is null, or no CMJ/throw data exists. Named
  // explicitly rather than just rendering as a blank/default, per instruction.
  unknownFields: string[]
}

// Sum of a Throwing-category slot's implied throw count -- bare `count` (bullpen/outing form)
// or sets*reps (the SxR form a Throwing line can also be written in). Returns 0 for a slot with
// neither shape filled in rather than throwing, since a malformed slot shouldn't crash the
// whole constraints computation.
function slotThrowCount(slot: { count?: number | null, sets?: number | null, reps?: number | null }): number {
  if (typeof slot.count === 'number' && slot.count > 0) return slot.count
  if (typeof slot.sets === 'number' && typeof slot.reps === 'number') return slot.sets * slot.reps
  return 0
}

export async function computeAthleteConstraints(
  supabase: SupabaseClient,
  pitcherId: string,
  exercisePool: EngineExercise[],
): Promise<AthleteConstraints> {
  const unknownFields: string[] = []
  const weekOf = currentWeekOf()

  const [{ data: athleteStateRow }, { data: throwLogRows }, { data: cmjRows }, { data: programRow }] = await Promise.all([
    supabase.from('athlete_state').select('*').eq('pitcher_id', pitcherId).maybeSingle(),
    supabase.from('throw_log').select('throw_date,count,implement,intent_level,throw_type').eq('pitcher_id', pitcherId).order('throw_date', { ascending: false }),
    supabase.from('cmj_results').select('*').eq('pitcher_id', pitcherId).order('test_date', { ascending: false }).limit(1),
    // Exact match on THIS week's row -- never "latest." If this week hasn't been touched yet,
    // there is no prescription for this week, full stop; falling back to a past week's row
    // would silently substitute an old prescription for a current fact, exactly the failure
    // mode this file exists to eliminate.
    supabase.from('programs').select('structured_days,carried_forward,first_edited_at,created_via').eq('pitcher_id', pitcherId).eq('week_of', weekOf).maybeSingle(),
  ])

  const weekProgramStatus: WeekProgramStatus =
    !programRow ? 'no_program'
      : (programRow.carried_forward && !programRow.first_edited_at) ? 'carried_forward_untouched'
      : 'edited'
  const prescribedExcluded = weekProgramStatus !== 'edited'
  // Descriptive only -- does NOT affect exclusion (a copy-created row is coach-initiated and
  // counts toward load like any other edit; see the discussion this replaced an "exclude
  // copies" idea with). What it does is let the render surface "this is a single-slot week
  // from a copy, not a written program" instead of a copied exercise reading as the whole
  // week's plan with no way to tell.
  const weekCreatedVia: 'direct' | 'rollover' | 'copy' | null = programRow?.created_via ?? null

  const athleteStateFound = !!athleteStateRow
  if (!athleteStateFound) {
    unknownFields.push('training_status', 'equipment_tier', 'throwing_status', 'season_phase', 'season_role', 'gates_passed', 'has_team_lift', 'team_lift_heavy_day', 'active_change', 'active_change_stage')
  } else {
    if (athleteStateRow.training_status == null) unknownFields.push('training_status')
    if (athleteStateRow.equipment_tier == null) unknownFields.push('equipment_tier')
    if (athleteStateRow.throwing_status == null) unknownFields.push('throwing_status')
    if (athleteStateRow.season_phase == null) unknownFields.push('season_phase')
    if (athleteStateRow.season_role == null) unknownFields.push('season_role')
    if (athleteStateRow.active_change == null) unknownFields.push('active_change')
  }

  // athlete_state is direct coach input today (AthleteStatePanel writes it via a single
  // upsert) -- every capability field sourced from it is genuinely coach_asserted, not
  // inferred. resolveCapability is still used (rather than reading the value bare) so this
  // slots into real precedence once Step G adds a second, competing source (coach_assertions /
  // logged reassessments) without this call site needing to change.
  const capField = <T,>(value: T | null): Sourced<T | null> =>
    resolveCapability<T>(value != null ? [sourced(value, 'coach_asserted')] : [])

  const gates_passed: string[] = athleteStateRow?.gates_passed ?? []
  const athleteTier: EquipmentTier | null = athleteStateRow?.equipment_tier ?? null

  // Gates not passed, and what each currently blocks -- scanned against the real exercise
  // pool, not a hardcoded description. A gate with nothing wired to it (G4, T1-T4 today) says
  // so plainly instead of silently listing nothing with no explanation.
  const gates_not_passed: GateBlock[] = ALL_GATES
    .filter(g => !gates_passed.includes(g))
    .map(gate => ({
      gate,
      blocks: exercisePool.filter(e => !e.deprecated && resolveRequiredGate(e) === gate).map(e => e.name),
    }))

  // allowed_movement_categories: every distinct category with at least one non-deprecated
  // exercise this athlete's equipment_tier covers AND whose gate (if any) is already passed.
  // Excluded categories are reported with why, not dropped silently.
  const categories = Array.from(new Set(exercisePool.map(e => e.movement_category).filter((c): c is string => c != null)))
  const allowed_movement_categories: string[] = []
  const excluded_movement_categories: ExcludedCategory[] = []
  for (const cat of categories) {
    const exercisesInCat = exercisePool.filter(e => e.movement_category === cat && !e.deprecated)
    const reachable = exercisesInCat.some(e => {
      const tierOk = e.equipment_tier == null || athleteTier == null || meetsEquipmentTier(athleteTier, e.equipment_tier)
      const gate = resolveRequiredGate(e)
      const gateOk = !gate || gates_passed.includes(gate)
      return tierOk && gateOk
    })
    if (reachable) {
      allowed_movement_categories.push(cat)
    } else {
      const blockingGate = exercisesInCat.map(e => resolveRequiredGate(e)).find(g => g)
      excluded_movement_categories.push({
        category: cat,
        reason: blockingGate
          ? `every exercise requires gate ${blockingGate}, not yet passed`
          : `no exercise in this category is within this athlete's ${athleteTier ?? 'unknown'} equipment tier`,
      })
    }
  }

  // Weekly high-CNS days + throwing load, both read from the CURRENT program's structured_days
  // -- this is "prescribed", the load of record, whether or not anything was logged.
  const structuredDays: Record<string, any[]> = (programRow?.structured_days as any) ?? {}
  let weekly_high_cns_committed_count = 0
  const highCNSExposures: HighCNSExposure[] = []
  let prescribedThrowTotal = 0
  let prescribedI4I5Count = 0
  let weekSlotCount = 0
  for (const day of DAY_ORDER) {
    let dayHasHighCNS = false
    for (const key of Object.keys(structuredDays)) {
      if (!key.startsWith(day + '___')) continue
      const category = key.slice((day + '___').length)
      const items = structuredDays[key]
      if (!Array.isArray(items)) continue
      weekSlotCount += items.length
      for (const it of items) {
        if (it?.cns === 'High') {
          dayHasHighCNS = true
          highCNSExposures.push({ day, exerciseName: it?.name ?? '(unnamed)', category })
        }
        if (category === 'Throwing') {
          prescribedThrowTotal += slotThrowCount(it)
          if (it?.intent_level === 'I4' || it?.intent_level === 'I5') prescribedI4I5Count++
        }
      }
    }
    if (dayHasHighCNS) weekly_high_cns_committed_count++
  }
  // Excluded (carried-forward-untouched or no program yet): report 0, tagged so the exclusion
  // itself is visible rather than looking like a genuine "nothing high-CNS this week" decision.
  const weekly_high_cns_committed = prescribedExcluded
    ? sourced(0, 'carried_forward_untouched' as Source)
    : sourced(weekly_high_cns_committed_count, 'prescribed' as Source)
  const weekly_high_cns_ceiling = deriveWeeklyHighCNSCeiling(athleteStateRow?.season_phase ?? null)
  const effectiveHighCNSCount = prescribedExcluded ? 0 : weekly_high_cns_committed_count
  const weekly_high_cns_violation: WeeklyHighCNSViolation | null =
    weekly_high_cns_ceiling != null && effectiveHighCNSCount > weekly_high_cns_ceiling
      ? { excess: effectiveHighCNSCount - weekly_high_cns_ceiling, removeCandidates: highCNSExposures }
      : null

  // Throw load: MAX-resolve the ACUTE (7d) figure between logged throw_log entries and this
  // week's prescribed Throwing slots -- both describe "this week," so comparing them is valid.
  // Chronic (28d) has no dated prescribed history yet (see file header) and stays logged-only.
  const throwEntries = (throwLogRows ?? []).map((r: any) => ({ throw_date: r.throw_date, count: r.count, implement: r.implement, throw_type: r.throw_type }))
  const loggedThrowLoad = computeThrowLoadRatio(throwEntries)
  const resolvedAcute = resolveLoad([
    sourced(loggedThrowLoad.acute7d, 'logged' as Source),
    // Omit the prescribed candidate entirely when excluded -- it must not compete in MAX at
    // all, not just lose on value (a carried-forward row's prescribedThrowTotal could easily
    // exceed logged reality for a pitcher who's stopped throwing, which is exactly the phantom
    // load this exclusion prevents).
    ...(prescribedExcluded ? [] : [sourced(prescribedThrowTotal, 'prescribed' as Source)]),
  ])
  // throwLoad stays exactly what lib/throwLog.ts computed -- untouched, logged-only, ratio and
  // all. resolvedAcute is the separate MAX-resolved figure. The two are DELIBERATELY not
  // merged into one number: acute and chronic must use the same resolution rule for a ratio
  // between them to mean anything, and chronic has no prescribed side yet (Step C).
  const throwLoad: ThrowLoadResult = loggedThrowLoad
  const ratioWithheldReason: string | null =
    resolvedAcute.source !== 'logged'
      ? `acute resolved from ${resolvedAcute.source} data (${resolvedAcute.value}, vs. ${loggedThrowLoad.acute7d} logged) while chronic remains logged-only -- a ratio combining the two would be comparing mismatched inputs. Re-enabled once the ledger (Step C) gives chronic a prescribed side too.`
      : null

  const weekly_i4_i5_count = resolveLoad([
    sourced(loggedThrowLoad.hasEnoughHistory || throwEntries.length > 0 ? countLoggedI4I5LastWeek(throwEntries) : 0, 'logged' as Source),
    ...(prescribedExcluded ? [] : [sourced(prescribedI4I5Count, 'prescribed' as Source)]),
  ])

  // Days since the most recent I4/I5 throwing exposure on record (any distance back, not just
  // within the 28-day window above). This is a recency fact derived from logs; if the current
  // program prescribes I4/I5 this week and nothing's logged yet, weekly_i4_i5_count above
  // already surfaces that -- this field stays log-derived on purpose, it answers "how long
  // since one was CONFIRMED," not "how long since one was written."
  const highIntentDates = (throwLogRows ?? [])
    .filter((r: any) => r.intent_level === 'I4' || r.intent_level === 'I5')
    .map((r: any) => r.throw_date as string)
    .sort((a, b) => b.localeCompare(a))
  let days_since_high_intent_throwing: number | null = null
  if (highIntentDates.length > 0) {
    const last = new Date(highIntentDates[0] + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    days_since_high_intent_throwing = Math.floor((today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
  }

  let cmj_classification: Sourced<string | null> = sourced(null, 'unknown')
  if (cmjRows && cmjRows.length > 0) {
    cmj_classification = sourced(classifyCMJ(cmjRows[0]).classification, 'inferred')
  } else {
    unknownFields.push('cmj_classification')
  }

  const activeChangeStage = capField<number>(athleteStateRow?.active_change_stage ?? null)
  const active_change_intent_cap = activeChangeStage.value != null ? STAGE_INTENT_CAP[activeChangeStage.value] ?? null : null

  return {
    pitcherId,
    athleteStateFound,
    weekOf,
    weekProgramStatus,
    weekCreatedVia,
    weekSlotCount,
    training_status: capField(athleteStateRow?.training_status ?? null),
    equipment_tier: capField<EquipmentTier>(athleteTier),
    throwing_status: capField(athleteStateRow?.throwing_status ?? null),
    season_phase: capField(athleteStateRow?.season_phase ?? null),
    season_role: capField(athleteStateRow?.season_role ?? null),
    gates_passed,
    gates_not_passed,
    allowed_movement_categories,
    excluded_movement_categories,
    weekly_high_cns_committed,
    weekly_high_cns_ceiling,
    weekly_high_cns_violation,
    has_team_lift: !!athleteStateRow?.has_team_lift,
    team_lift_heavy_day: athleteStateRow?.has_team_lift ? (athleteStateRow?.team_lift_heavy_day ?? null) : null,
    throwLoad,
    resolvedAcute7d: resolvedAcute,
    ratioWithheldReason,
    weekly_i4_i5_count,
    active_change: capField(athleteStateRow?.active_change ?? null),
    active_change_stage: activeChangeStage,
    active_change_intent_cap,
    days_since_high_intent_throwing,
    cmj_classification,
    unknownFields: Array.from(new Set(unknownFields)),
  }
}

// Logged I4/I5 sessions in the trailing 7 days -- the logged-side candidate for
// weekly_i4_i5_count's MAX resolution. Separate from days_since_high_intent_throwing (which
// looks arbitrarily far back for the single most recent one).
function countLoggedI4I5LastWeek(entries: { throw_date: string, intent_level?: string | null }[]): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  return entries.filter((e: any) => {
    if (e.intent_level !== 'I4' && e.intent_level !== 'I5') return false
    const d = new Date(e.throw_date + 'T00:00:00')
    const diff = Math.floor((today.getTime() - d.getTime()) / dayMs)
    return diff >= 0 && diff < 7
  }).length
}

// Pure formatting -- kept separate from computeAthleteConstraints so it's testable/reusable
// (and so a future non-prompt consumer of this data, e.g. a UI panel, isn't forced through
// this exact text shape). Facts only, no explanatory prose (item 10, bug 2) -- narration about
// an assumed context (e.g. "a competitive-phase starter") can contradict this athlete's real
// state and has been removed; the WHY for any derived number belongs in the principles doc,
// stated once, not re-narrated per prompt.
export function renderAthleteConstraintsBlock(c: AthleteConstraints): string {
  const lines: string[] = []
  lines.push('COMPUTED CONSTRAINTS — these are facts about this athlete, not guidance. Do not contradict them. Every value is tagged with its source: [coach_asserted] > [logged] > [inferred] for capability facts; [prescribed] and [logged] both count toward load/exposure facts, higher one wins.')
  lines.push('')
  if (!c.athleteStateFound) {
    lines.push('⚠ No athlete_state row exists for this pitcher yet -- every capability field below is UNKNOWN, not "not applicable."')
  }
  if (c.weekProgramStatus === 'no_program') {
    lines.push(`- This Week's Program (${c.weekOf}): none written yet [no_program]. No prescribed load exists for this week -- every LOAD field below is logged-only until a program is written.`)
  } else if (c.weekProgramStatus === 'carried_forward_untouched') {
    lines.push(`- This Week's Program (${c.weekOf}): carried forward from a previous week, not yet edited [carried_forward_untouched]. Its content is NOT counted as this week's prescribed load -- editing it once will confirm it as real.`)
  } else if (c.weekCreatedVia === 'copy') {
    // Counted honestly (this row is NOT excluded -- see provenance.ts and the discussion this
    // replaced an "exclude copies" idea with), but must not read as a full week's plan when
    // it's really one exercise from a copy-to-pitcher action. weekSlotCount says exactly how
    // much exists so the ceiling/load math above is legible, not mysterious.
    lines.push(`- This Week's Program (${c.weekOf}): ${c.weekSlotCount} slot(s) total, created via a single-exercise copy [copy] -- NOT a full written program. Load fields above reflect exactly these ${c.weekSlotCount} slot(s), counted honestly, not a complete week's plan.`)
  } else {
    lines.push(`- This Week's Program (${c.weekOf}): written and edited this week [edited], ${c.weekSlotCount} slot(s) total.`)
  }
  lines.push(`- Training Status: ${c.training_status.value ?? 'UNKNOWN'} ${tag(c.training_status.source)}`)
  lines.push(`- Equipment Tier: ${c.equipment_tier.value ?? 'UNKNOWN'} ${tag(c.equipment_tier.source)}`)
  lines.push(`- Throwing Status: ${c.throwing_status.value ?? 'UNKNOWN'} ${tag(c.throwing_status.source)}`)
  lines.push(`- Season Phase: ${c.season_phase.value ?? 'UNKNOWN'} ${tag(c.season_phase.source)}`)
  lines.push(`- Season Role: ${c.season_role.value ?? 'UNKNOWN'} ${tag(c.season_role.source)}`)
  lines.push(`- Gates Passed: ${c.gates_passed.length > 0 ? c.gates_passed.join(', ') : 'none'}`)
  if (c.gates_not_passed.length > 0) {
    lines.push('- Gates NOT Passed:')
    for (const g of c.gates_not_passed) {
      lines.push(`  - ${g.gate}: blocks ${g.blocks.length > 0 ? g.blocks.join(', ') : '(nothing currently wired to this gate)'}`)
    }
  }
  lines.push(`- Allowed Movement Categories: ${c.allowed_movement_categories.length > 0 ? c.allowed_movement_categories.join(', ') : 'none'}`)
  if (c.excluded_movement_categories.length > 0) {
    lines.push('- Excluded Movement Categories:')
    for (const ex of c.excluded_movement_categories) lines.push(`  - ${ex.category}: ${ex.reason}`)
  }
  const ceilingPart = c.weekly_high_cns_ceiling != null ? `of ${c.weekly_high_cns_ceiling} max` : '(season_phase unknown, no ceiling derived)'
  lines.push(`- Weekly High-CNS Days Committed: ${c.weekly_high_cns_committed.value} ${ceilingPart} ${tag(c.weekly_high_cns_committed.source)}`)
  if (c.weekly_high_cns_violation) {
    const v = c.weekly_high_cns_violation
    lines.push(`  - RULE FAILED: exceeds weekly high-CNS ceiling by ${v.excess}. Do not add another high-CNS exposure this week.`)
    lines.push(`  - Nearest legal alternative: remove ${v.excess} of the following ${v.removeCandidates.length} committed high-CNS exposure(s) to be back within ceiling:`)
    for (const exp of v.removeCandidates) lines.push(`    - ${exp.day} / ${exp.category}: ${exp.exerciseName}`)
  }
  if (c.has_team_lift) lines.push(`- Team Lift Heavy Day: ${c.team_lift_heavy_day ?? 'set, but no day specified'}`)
  const tl = c.throwLoad
  lines.push(`- Throw Load, Acute (7d): ${c.resolvedAcute7d.value} ${tag(c.resolvedAcute7d.source)}`)
  lines.push(`- Throw Load, Chronic Weekly Avg (28d): ${tl.chronicWeeklyAvg28d} [logged]`)
  if (c.ratioWithheldReason) {
    lines.push(`- Acute:Chronic Ratio: WITHHELD -- ${c.ratioWithheldReason}`)
  } else if (tl.hasEnoughHistory) {
    lines.push(`- Acute:Chronic Ratio: ${tl.ratio} (band ${tl.band})`)
  } else {
    lines.push(`- Acute:Chronic Ratio: not meaningful yet -- chronic baseline building, ${tl.daysOfHistory} of 28 days logged [logged]`)
  }
  lines.push(`- Weekly I4/I5 Count: ${c.weekly_i4_i5_count.value} ${tag(c.weekly_i4_i5_count.source)}`)
  if (c.active_change.value) {
    const stageLabel = c.active_change_stage.value ?? 'UNKNOWN'
    const capLine = c.active_change_intent_cap ? `Intent Cap: ${c.active_change_intent_cap}` : 'Intent Cap: none derived (stage missing or outside 1-4)'
    lines.push(`- Active Change: "${c.active_change.value}" ${tag(c.active_change.source)}. Stage ${stageLabel} ${tag(c.active_change_stage.source)}. ${capLine}.`)
  } else {
    lines.push('- Active Change: none on record')
  }
  lines.push(`- Days Since Last I4/I5 Throwing: ${c.days_since_high_intent_throwing ?? 'none on record'} [logged]`)
  if (c.cmj_classification.value) lines.push(`- Latest CMJ Classification: ${c.cmj_classification.value} ${tag(c.cmj_classification.source)}`)
  if (c.unknownFields.length > 0) lines.push(`- Unknown/Unavailable Fields: ${c.unknownFields.join(', ')}`)
  return lines.join('\n')
}
```

### `lib/engine/cnsAdjacency.ts`

```ts
// This one rule is week-level, not line-level -- whether two high-CNS days sit back to back is
// a property of the whole week's shape, not any single slot, so it doesn't fit the
// (athleteState, slot) -> RuleResult signature the other rules in this module share. It also
// warns rather than rejects: the caller (parseAndImportProgram) surfaces its output as an
// advisory note, never a skipped/rejected line.

export type DayCNSInput = { day: string, exercises: { cns?: string | null }[] }
export type CNSAdjacencyWarning = { day1: string, day2: string }

// A day counts as "high-CNS" if ANY exercise assigned to it (any category) is tagged
// cns:'High'. dayOrder is passed in rather than assumed, so this stays pure -- callers own
// what "the week" means (currently Monday..Sunday, no wraparound: Sunday and Monday are not
// treated as adjacent).
export function checkCNSAdjacency(days: DayCNSInput[], dayOrder: string[]): CNSAdjacencyWarning[] {
  const isHighCNSDay = (d: DayCNSInput) => d.exercises.some(e => e.cns === 'High')
  const byDay = new Map(days.map(d => [d.day, d]))
  const warnings: CNSAdjacencyWarning[] = []
  for (let i = 0; i < dayOrder.length - 1; i++) {
    const d1 = byDay.get(dayOrder[i])
    const d2 = byDay.get(dayOrder[i + 1])
    if (d1 && d2 && isHighCNSDay(d1) && isHighCNSDay(d2)) {
      warnings.push({ day1: dayOrder[i], day2: dayOrder[i + 1] })
    }
  }
  return warnings
}
```

### `lib/engine/deprecatedGate.ts`

```ts
import { EngineAthleteState, EngineSlot, RuleResult } from './types'

// athleteState isn't used -- deprecation is a property of the exercise itself, not the
// athlete -- but the (athleteState, slot) signature is kept consistent across every rule in
// this module so the validator can call them uniformly without special-casing one.
export function checkDeprecated(_athleteState: EngineAthleteState, slot: EngineSlot): RuleResult {
  if (!slot.exercise.deprecated) return { ok: true }
  return { ok: false, reason: `"${slot.exercise.name}" is deprecated and can no longer be added to new programs.` }
}
```

### `lib/engine/equipmentGate.ts`

```ts
import { EngineAthleteState, EngineExercise, EngineSlot, EquipmentTier, RuleResult } from './types'

// Rank = how much equipment a tier needs. E1 (full weight room) is the MOST demanding, E3
// (bands/med balls/bodyweight) the LEAST -- an athlete tagged E1 can do E1/E2/E3 work, one
// tagged E3 can only do E3 work. Lower rank number = needs more equipment.
const TIER_RANK: Record<EquipmentTier, number> = { E1: 1, E2: 2, E3: 3 }

// Exposed for callers (athleteConstraints.ts's allowed_movement_categories) that need the same
// "can this athlete do this tier" comparison without going through the full checkEquipmentTier
// rejection-with-suggestion flow.
export function meetsEquipmentTier(athleteTier: EquipmentTier, requiredTier: EquipmentTier): boolean {
  return TIER_RANK[athleteTier] <= TIER_RANK[requiredTier]
}

// Same movement_category, not deprecated, and within what the athlete's equipment_tier can
// actually support -- the substitution ladder a gap in equipment access resolves against.
// Prefers the closest tier to what was originally requested (least drastic swap) over jumping
// straight to the lowest common denominator.
function findSubstitute(slot: EngineSlot, athleteTierRank: number, exercisePool: EngineExercise[]): EngineExercise | null {
  const candidates = exercisePool.filter(e =>
    !e.deprecated &&
    e.id !== slot.exercise.id &&
    e.movement_category != null &&
    e.movement_category === slot.exercise.movement_category &&
    e.equipment_tier != null &&
    TIER_RANK[e.equipment_tier] >= athleteTierRank
  )
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => TIER_RANK[a.equipment_tier as EquipmentTier] - TIER_RANK[b.equipment_tier as EquipmentTier])[0]
}

// Fails OPEN (ok:true) when either side is unknown -- a missing equipment_tier tag on an
// exercise, or an athlete_state row that's never been filled in, isn't grounds to block an
// import. This rule only fires when it can compare two real values.
export function checkEquipmentTier(athleteState: EngineAthleteState, slot: EngineSlot, exercisePool: EngineExercise[]): RuleResult {
  const required = slot.exercise.equipment_tier
  const athleteTier = athleteState.equipment_tier
  if (required == null || athleteTier == null) return { ok: true }
  if (TIER_RANK[athleteTier] <= TIER_RANK[required]) return { ok: true }
  const sub = findSubstitute(slot, TIER_RANK[athleteTier], exercisePool)
  return {
    ok: false,
    reason: `"${slot.exercise.name}" requires ${required} equipment, but this pitcher is tagged ${athleteTier}.`,
    suggestion: sub ? `Try "${sub.name}" (${sub.equipment_tier}, same movement category) instead.` : undefined,
  }
}
```

### `lib/engine/gateRequirement.ts`

```ts
import { EngineAthleteState, EngineExercise, EngineSlot, Gate, RuleResult } from './types'

// Loaded jump variants -- keyed by exercise id, not movement_category, since only the LOADED
// version of a jump requires this gate. The unloaded bodyweight version of the same movement
// (Broad Jump, Lateral Bound, Pogo Hops, etc) does not -- gating the whole category would
// incorrectly catch those too.
const EXERCISE_GATE_REQUIREMENTS: Record<string, Gate> = {
  ex_069: 'G1', // Trap Bar Jump
  ex_070: 'G1', // DB Jump Shrug
  ex_071: 'G1', // DB Squat Jump
  ex_072: 'G1', // Band-Resisted Squat Jump
  ex_073: 'G1', // Weighted Broad Jump
  ex_074: 'G1', // Weighted Lateral Bound
}

// Whole-category gates: every exercise in the category shares the same requirement, no
// per-exercise exceptions within it.
const CATEGORY_GATE_REQUIREMENTS: Record<string, Gate> = {
  unilateral_lateral_power: 'G2', // single-leg plyometrics: Lateral Bound, Skater Jump (unloaded)
  keat: 'G3', // Depth Jump, Altitude Landing, Overspeed Eccentric Drop
}

// Bounce-phase throwing drills (hop throws) are single-leg plyometric ground contacts, same
// risk profile as unilateral_lateral_power above -- but they live under movement_category
// 'throwing_progression_drill', not one of the lateral-power categories, so they're gated by
// throwing_phase instead of movement_category.
const THROWING_PHASE_GATE_REQUIREMENTS: Record<string, Gate> = {
  Bounce: 'G2',
}

// Exposed separately from checkGateRequirement so callers that need to know WHAT a gate
// unlocks (e.g. athleteConstraints.ts building a "gates not passed, and what each blocks"
// list) can resolve any given exercise's requirement without re-deriving this lookup order
// themselves. Precedence: exercise-specific, then movement_category, then throwing_phase.
export function resolveRequiredGate(exercise: EngineExercise): Gate | undefined {
  return (
    EXERCISE_GATE_REQUIREMENTS[exercise.id] ??
    (exercise.movement_category ? CATEGORY_GATE_REQUIREMENTS[exercise.movement_category] : undefined) ??
    (exercise.throwing_phase ? THROWING_PHASE_GATE_REQUIREMENTS[exercise.throwing_phase] : undefined)
  )
}

export function checkGateRequirement(athleteState: EngineAthleteState, slot: EngineSlot): RuleResult {
  const required = resolveRequiredGate(slot.exercise)
  if (!required) return { ok: true }
  if (athleteState.gates_passed.includes(required)) return { ok: true }
  return { ok: false, reason: `"${slot.exercise.name}" requires gate ${required}, which this pitcher hasn't passed.` }
}
```

### `lib/engine/index.ts`

```ts
// Program-validation engine. Every rule here is a pure function -- data in, a verdict out, no
// Supabase access of its own. parseAndImportProgram is the current (and, for now, only)
// caller: it loads the target pitcher's athlete_state and the exercise pool once, then calls
// these for each parsed line. Nothing else should reimplement this logic inline.
//
// RETIRED, DO NOT RE-OPEN without new data: a "load x displacement x reps" arm-care audit was
// considered and explicitly retired (2026-09-16). It isn't computable on today's schema --
// `load` on a program entry is a %1RM string, not an absolute weight; nothing stores per-
// exercise displacement or a load_type (dynamic-external vs. bodyweight-fraction vs. band-
// variable vs. isometric -- these aren't the same formula); nothing logs sets/reps actually
// performed vs. prescribed; and profiles.one_rms, the one field that could anchor an absolute
// load, is unpopulated. Building it now would mean inventing most of its own inputs. Revisit
// only if real per-lift 1RMs, actual-performance logging, and a per-exercise load_type get
// specced first -- not by re-deriving displacement estimates to make the number appear.
export * from './types'
export { checkEquipmentTier, meetsEquipmentTier } from './equipmentGate'
export { checkDeprecated } from './deprecatedGate'
export { checkGateRequirement, resolveRequiredGate } from './gateRequirement'
export { checkThrowingIntent } from './throwingIntentGate'
export { checkCNSAdjacency, type DayCNSInput, type CNSAdjacencyWarning } from './cnsAdjacency'
export {
  computeAthleteConstraints, renderAthleteConstraintsBlock,
  type AthleteConstraints, type GateBlock, type ExcludedCategory,
  type HighCNSExposure, type WeeklyHighCNSViolation,
} from './athleteConstraints'
export {
  type Source, type Sourced, sourced, resolveLoad, resolveCapability, tag,
} from './provenance'
```

### `lib/engine/provenance.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { resolveLoad, resolveCapability, sourced } from './provenance'

describe('resolveLoad', () => {
  it('picks the maximum value across sources, not the most recent or most-trusted', () => {
    const result = resolveLoad([
      sourced(60, 'logged'),
      sourced(120, 'prescribed'),
    ])
    expect(result).toEqual({ value: 120, source: 'prescribed' })
  })

  it('ignores null candidates rather than treating them as 0', () => {
    const result = resolveLoad([
      sourced(null, 'logged'),
      sourced(40, 'prescribed'),
    ])
    expect(result).toEqual({ value: 40, source: 'prescribed' })
  })

  it('falls back to 0/unknown when nothing has a value', () => {
    const result = resolveLoad([sourced(null, 'logged'), sourced(null, 'prescribed')])
    expect(result).toEqual({ value: 0, source: 'unknown' })
  })
})

describe('resolveCapability', () => {
  it('coach_asserted outranks logged even when logged is the only other candidate', () => {
    const result = resolveCapability([
      sourced('developing', 'logged'),
      sourced('restricted', 'coach_asserted'),
    ])
    expect(result).toEqual({ value: 'restricted', source: 'coach_asserted' })
  })

  it('falls through to a lower-precedence source when a higher one is null', () => {
    const result = resolveCapability([
      sourced(null, 'coach_asserted'),
      sourced('developing', 'logged'),
    ])
    expect(result).toEqual({ value: 'developing', source: 'logged' })
  })

  it('never lets prescribed compete for a capability fact', () => {
    // resolveCapability's precedence list has no 'prescribed' entry at all -- a candidate
    // tagged prescribed must never win a capability resolution, only coach_asserted/logged/
    // inferred compete. Passing one in should be a no-op, not a crash or a false positive.
    const result = resolveCapability([sourced('advanced', 'prescribed' as any)])
    expect(result).toEqual({ value: null, source: 'unknown' })
  })
})
```

### `lib/engine/provenance.ts`

```ts
// Source tagging and the two resolution rules that govern every field in the constraints
// block. See principles doc section 0.x (once written) for the full rationale -- short
// version: under-counting load and over-crediting capability are the two failure modes that
// hurt an athlete, and they need opposite resolution rules to both be blocked at once.

// carried_forward_untouched: a program row copied forward from a previous week and never
// edited since. Its structured_days is real data, but it must never count as this week's
// genuine prescribed load (that would accrue phantom load for a pitcher who's stopped being
// actively programmed -- the mirror image of the bug this project exists to fix). Callers
// building resolveLoad candidates must simply omit a carried-forward-untouched row's numbers
// (pass null, not a value tagged with this source) -- this source exists so the FACT that a
// row was excluded can still be surfaced in the block, not so it can compete in resolution.
export type Source = 'coach_asserted' | 'logged' | 'prescribed' | 'inferred' | 'unknown' | 'carried_forward_untouched'
export type Sourced<T> = { value: T, source: Source }

export function sourced<T>(value: T, source: Source): Sourced<T> {
  return { value, source }
}

// LOAD / EXPOSURE fields (weighted throw totals, I4/I5 count, high-CNS day count, plyo
// contacts, pitch counts): resolve by MAXIMUM across all sources that have a real value.
// Missing/zero candidates are ignored, not treated as "0 wins" -- a field with no sources at
// all correctly falls through to 0/'unknown' via the final fallback, not because 0 beat
// something.
export function resolveLoad(candidates: Sourced<number | null>[]): Sourced<number> {
  let best: Sourced<number> | null = null
  for (const c of candidates) {
    if (c.value == null) continue
    if (!best || c.value > best.value) best = { value: c.value, source: c.source }
  }
  return best ?? { value: 0, source: 'unknown' }
}

// CAPABILITY fields (gate status, change stage, ROM, CMJ class, training status): resolve by
// PRECEDENCE, highest-trust source wins regardless of recency. 'prescribed' has no meaning for
// a capability fact (a program doesn't assert an athlete's gate status), so it's deliberately
// excluded from this list -- only coach_asserted/logged/inferred compete here.
const CAPABILITY_PRECEDENCE: Source[] = ['coach_asserted', 'logged', 'inferred']

export function resolveCapability<T>(candidates: Sourced<T | null>[]): Sourced<T | null> {
  for (const source of CAPABILITY_PRECEDENCE) {
    const match = candidates.find(c => c.source === source && c.value != null)
    if (match) return { value: match.value, source: match.source }
  }
  return { value: null, source: 'unknown' }
}

// Special case NOT yet implemented here (needs Step G's coach_assertions table to exist first):
// a coach assertion is asymmetric for red flags / Restricted throwing_status specifically -- it
// can SET a flag or set throwing_status to Restricted (a capability fact getting more
// conservative), but it can never CLEAR a flag or move throwing_status off Restricted; only a
// dated reassessment record can do that. This is a domain-specific override on top of plain
// source precedence, not something resolveCapability's generic ranking can express -- when
// coach_assertions exists, the caller must check this rule BEFORE calling resolveCapability,
// not fold it into the precedence list.

// Render helper: every line in the constraints block that carries a resolved value shows its
// source inline, e.g. "Weekly High-CNS Days Committed: 2 [prescribed]" -- so the reader (human
// or model) can see whether a number came from what was written, what was logged, or a gap.
export function tag(source: Source): string {
  return `[${source}]`
}
```

### `lib/engine/throwingIntentGate.ts`

```ts
import { EngineAthleteState, EngineSlot, RuleResult } from './types'

const HIGH_INTENT_LEVELS = new Set(['I4', 'I5'])

// intent_level only exists on Throwing-category slots (parsed from a prescription like
// "3x10 @ I4" -- see parseAndImportProgram). A slot with no intent_level (every non-throwing
// slot, and any throwing slot with no I-level given) passes through untouched -- this rule has
// nothing to say about it.
export function checkThrowingIntent(athleteState: EngineAthleteState, slot: EngineSlot): RuleResult {
  if (athleteState.throwing_status !== 'restricted') return { ok: true }
  if (!slot.intent_level || !HIGH_INTENT_LEVELS.has(slot.intent_level.toUpperCase())) return { ok: true }
  return { ok: false, reason: `This pitcher's throwing status is "restricted" -- ${slot.intent_level.toUpperCase()} throwing intent isn't allowed.` }
}
```

### `lib/engine/types.ts`

```ts
// Shared types for the program-validation engine (lib/engine/*). These are pure, data-in
// data-out functions with no Supabase access of their own -- callers (parseAndImportProgram
// today, anything else later) load athlete_state and the exercise pool themselves and pass
// them in.

export type Gate = 'G1' | 'G2' | 'G3' | 'G4' | 'T1' | 'T2' | 'T3' | 'T4'

export type EquipmentTier = 'E1' | 'E2' | 'E3'

// Subset of athlete_state actually needed by the rules in this module. Deliberately narrower
// than the full athlete_state row shape so a rule can't reach for a field nobody's decided the
// meaning of yet.
export type EngineAthleteState = {
  equipment_tier: EquipmentTier | null
  throwing_status: 'building' | 'developing' | 'competing' | 'restricted' | null
  gates_passed: string[]
}

// Subset of an exercise (BUILT_IN_EXERCISES or custom_exercises) needed by these rules.
export type EngineExercise = {
  id: string
  name: string
  movement_category: string | null
  equipment_tier: EquipmentTier | null
  deprecated?: boolean
  // Only meaningful for movement_category:'throwing_progression_drill' exercises --
  // 'Constrain'|'Time'|'Adapt'|'Move'|'Bounce'|'Transfer'|'Compete'. null for everything else.
  throwing_phase?: string | null
}

// One line being validated during import (or, later, any other program-editing path).
// intent_level is only meaningful for Throwing-category slots -- 'I1'..'I5', parsed from a
// prescription like "3x10 @ I4". null/undefined for everything else.
export type EngineSlot = {
  day: string
  category: string
  exercise: EngineExercise
  intent_level?: string | null
}

export type RuleResult =
  | { ok: true }
  | { ok: false, reason: string, suggestion?: string }
```

---

## 3. `PRINCIPLES_PROMPT_CHAR_BUDGET` and `selectPrinciplesSections`

Current value: `PRINCIPLES_PROMPT_CHAR_BUDGET = 40000` (lib/principlesSections.ts:28).

Exact function (lib/principlesSections.ts:42-68):

```ts
export function selectPrinciplesSections(
  sections: PrinciplesSection[],
  contextTags: string[],
  charBudget: number = PRINCIPLES_PROMPT_CHAR_BUDGET,
): PrinciplesSelection {
  const alwaysInclude = sections.filter(s => s.always_include)
  const contextMatched = sections
    .filter(s => !s.always_include && s.tags.some(t => contextTags.includes(t)))
    .sort((a, b) => a.sort_order - b.sort_order)

  const alwaysIncludeChars = alwaysInclude.reduce((sum, s) => sum + s.body.length, 0)
  let runningChars = alwaysIncludeChars
  const included: PrinciplesSection[] = [...alwaysInclude]
  const omitted: PrinciplesSection[] = []

  for (const s of contextMatched) {
    if (runningChars + s.body.length <= charBudget) {
      included.push(s)
      runningChars += s.body.length
    } else {
      omitted.push(s)
    }
  }

  included.sort((a, b) => a.sort_order - b.sort_order)
  return { included, omitted, totalChars: runningChars }
}
```
---

## 4. `contextTags` computation in `buildPrompt` (app/coach/page.tsx)

What `athlete_state`-derived fields map to which tags, exactly as computed at click-time (app/coach/page.tsx:1045-1072):

```ts
  const buildPrompt=async(coachNote:string='')=>{
    const lastPitchSession=logs.find((l:any)=>l.pitch_count!=null)||null
    const restOwed=lastPitchSession?daysUntilClearToThrow(lastPitchSession.pitch_count,lastPitchSession.log_date):0
    const lastCMJ=cmjResults[0]
    const {classification}=classifyCMJ(lastCMJ)
    const rule=recommendationRules.find(r=>r.classification===classification)
    const recentLogs=logs.slice(0,7)
    const effVelocity=getEffectiveVelocity(selected,cmjResults)||null
    const armFlagStatuses=computeArmCareFlagStatuses(armCareTests[0]||null,effVelocity)

    // Computed, not narrative -- athlete_state/throw_log/cmj_results/the exercise library run
    // through lib/engine/athleteConstraints.ts, never the principles text. Moved ahead of
    // contextTags (below) because contextTags now needs season_phase/throwing_status/
    // active_change off this same object.
    const constraints=selected?await computeAthleteConstraints(supabase,selected.id,buildExercisePool()):null
    const constraintsBlock=constraints?renderAthleteConstraintsBlock(constraints):'COMPUTED CONSTRAINTS — no pitcher selected.'

    // Real-content check against the live principles_sections tag vocabulary (queried directly,
    // not assumed) as of this fix: arm_care, athlete_setup, background, calendar, conditioning,
    // deload, diagnostics, in_season, lifting, movement_change, off_season, recovery,
    // return_to_throw, templates, testing, throwing, velocity_block. No gate-scoped tags
    // (G1-G4/T1-T4) exist anywhere yet, so gates_passed has nothing to map onto today --
    // deliberately not inventing a tag convention with zero content to match it.
    const SEASON_PHASE_TAGS:Record<string,string[]>={
      transition:['off_season'],
      general_prep:['off_season'],
      specific_prep:['off_season'],
      // 'first_transition' isn't a tag that exists on any row today (confirmed) -- the actual
      // first-transition content (e.g. the off-season-week template) is tagged off_season only.
      // Emit both: off_season for real matches now, first_transition so this becomes correct
      // automatically if/when sections get tagged more precisely.
      first_transition:['off_season','first_transition'],
      competitive:['in_season'],
    }
    const seasonPhaseTags=constraints?.season_phase.value?(SEASON_PHASE_TAGS[constraints.season_phase.value]||[]):[]
    // Same reasoning as above: 'restricted' isn't a real tag yet either -- the matching real
    // content lives under 'return_to_throw'. Emit both.
    const restrictedTags=constraints?.throwing_status.value==='restricted'?['restricted','return_to_throw']:[]
    const movementChangeTags=constraints?.active_change.value?['movement_change']:[]

    // Context tags used to decide which non-always-include principles_sections are relevant to
    // THIS pitcher right now.
    const contextTags:string[]=[
      classification.toLowerCase().replace(/\s+/g,'_'),
      restOwed>0?'rest_owed':'cleared_to_throw',
      ...(armFlagStatuses.includes('Flag')?['arm_care_flag']:[]),
      ...(armFlagStatuses.includes('Caution')?['arm_care_caution']:[]),
      ...seasonPhaseTags,
      ...restrictedTags,
      ...movementChangeTags,
    ]
```
---

## 5. Real `buildPrompt` output for a real pitcher, run today

Pitcher: **Austin Mora** (id `c5980d85-ec0b-47b3-9b72-df03c0908a28`)
Run at: 2026-09-24T15:39:03.469Z

- Total sections included: **33**
- Total chars (included section bodies): **39,748**
- Context tags that fired: `developing, cleared_to_throw, off_season`
- Sections omitted for budget: **4**
- Summary line: 33 section(s) included (22 always-include, 11 context), 4 omitted (budget)

### Sections included

- strength 3.1 — Training status (always-include)
- strength 3.2 — Equipment tier (always-include)
- strength 3.3 — Readiness gates (always-include)
- strength 4.2 — The load table (always-include)
- strength 4.3 — Load by exercise class (always-include)
- strength 4.5 — Exercise selection and order (always-include)
- strength 4.6 — Frequency — the CNS budget (always-include)
- strength 4.7 — One primary quality per phase (always-include)
- strength 4.8 — Progression, deload, and regression (always-include)
- strength 5.2 — The governing theory (always-include)
- strength 5.3 — The college baseball annual plan
- strength 5.4 — Phase prescriptions
- strength 5.5 — Non-linear structure for advanced athletes
- strength 6.5 — KEAT and shock training
- strength 6.6 — Weighted implement throwing
- strength 8.4 — Arm care volume — the computable formula (always-include)
- strength 9.1 — Template structure (always-include)
- strength 9.3 — Off-season week — general preparatory
- strength 9.4 — Off-season week — specific preparatory
- strength 9.5 — Off-season week — first transition (power / KEAT block)
- throwing 12.1 — Intent scale (always-include)
- throwing 12.1a — What reduced effort actually delivers — and why it changes the volume math (always-include)
- throwing 12.2 — Throwing status (always-include)
- throwing 12.3 — Gates — what has to be true before a guy is allowed to do something (always-include)
- throwing 13.7 — One change at a time — hard rule (always-include)
- throwing 14.6 — Velocity development — what actually drives it
- throwing 14.7 — Constrained positions do not reduce arm stress (always-include)
- throwing 14.10 — Prescribing velocity work intelligently
- throwing 15.2 — Arm load accounting (always-include)
- throwing 15.2a — Where the weekly budget comes from — and why it isn't a number (always-include)
- throwing 16.1 — Annual structure
- throwing 17.2 — Red flags — stop throwing (always-include)
- throwing 19.1 — Structure (always-include)

### Sections omitted (over budget)

- throwing 16.4 — Movement change and the calendar
- throwing 19.2 — Movement block session — off-season
- throwing 19.3 — Mixed practice session — off-season
- throwing 19.4 — Velocity session — first transition only

### Full prompt output

````text
You are helping Coach Salzman write a weekly training program for pitcher Austin Mora.

PITCHER DATA:
- Avg Velocity: — mph
- Weekly Pitches: — | HE Throws: —
- Last Outing: 28 pitches on 2026-08-01 (Pitch Smart: 0 day(s) rest, 0 still owed)
- CMJ: Jump 20.4in | RSI 0.45 | PP/kg 58.4 W/kg
- Neuro Classification: Developing


RECENT LOGS:
  2026-08-01: vel=—mph, feeling=9/10, soreness=[Shoulder]
  2026-07-31: vel=—mph, feeling=7/10, soreness=[none]
  2026-07-26: vel=—mph, feeling=8/10, soreness=[Forearm]
  2026-07-13: vel=—mph, feeling=7/10, soreness=[Other]
  2026-07-12: vel=—mph, feeling=8/10, soreness=[Shoulder]
  2026-07-10: vel=—mph, feeling=7/10, soreness=[none]
  2026-07-08: vel=—mph, feeling=7/10, soreness=[Other]

COMPUTED CONSTRAINTS — these are facts about this athlete, not guidance. Do not contradict them. Every value is tagged with its source: [coach_asserted] > [logged] > [inferred] for capability facts; [prescribed] and [logged] both count toward load/exposure facts, higher one wins.

- This Week's Program (2026-09-21): written and edited this week [edited], 44 slot(s) total.
- Training Status: advanced [coach_asserted]
- Equipment Tier: E1 [coach_asserted]
- Throwing Status: building [coach_asserted]
- Season Phase: general_prep [coach_asserted]
- Season Role: starter [coach_asserted]
- Gates Passed: G1, G2, G3, T1, T2, G4
- Gates NOT Passed:
  - T3: blocks (nothing currently wired to this gate)
  - T4: blocks (nothing currently wired to this gate)
- Allowed Movement Categories: bilateral_squat_strength, unilateral_squat_strength, unilateral_frontal_plane_strength, bilateral_hinge_strength, unilateral_hinge_strength, bilateral_hinge_power, bilateral_horizontal_push_strength, unilateral_horizontal_push_strength, unilateral_vertical_push_strength, bilateral_horizontal_pull_strength, unilateral_horizontal_pull_strength, bilateral_vertical_pull_strength, bilateral_vertical_push_strength, rotational_power, bilateral_horizontal_power, keat, unilateral_lateral_power, bilateral_vertical_power, linear_speed, anti_extension_core, anti_lateral_flexion_core, anti_rotation_core, adductor_strength, quadrupedal_stability, scapular_activation, rotator_cuff_strength, forearm_wrist_strength, mobility_flexibility, throwing_progression_drill, gait_stability, bilateral_vertical_push_power
- Weekly High-CNS Days Committed: 4 of 3 max [prescribed]
  - RULE FAILED: exceeds weekly high-CNS ceiling by 1. Do not add another high-CNS exposure this week.
  - Nearest legal alternative: remove 1 of the following 7 committed high-CNS exposure(s) to be back within ceiling:
    - Monday / Speed/Power: Sled Push
    - Monday / Main Exercises: Barbell Back Squat
    - Monday / Main Exercises: Barbell Bench Press
    - Wednesday / Main Exercises: Trap Bar Deadlift
    - Friday / Main Exercises: Barbell Row
    - Sunday / Main Exercises: Broad Jump
    - Sunday / Main Exercises: 30-Yard Sprint
- Throw Load, Acute (7d): 96 [prescribed]
- Throw Load, Chronic Weekly Avg (28d): 0 [logged]
- Acute:Chronic Ratio: WITHHELD -- acute resolved from prescribed data (96, vs. 0 logged) while chronic remains logged-only -- a ratio combining the two would be comparing mismatched inputs. Re-enabled once the ledger (Step C) gives chronic a prescribed side too.
- Weekly I4/I5 Count: 0 [logged]
- Active Change: none on record
- Days Since Last I4/I5 Throwing: none on record [logged]
- Latest CMJ Classification: Developing [inferred]
- Unknown/Unavailable Fields: active_change

TRAINING PRINCIPLES (33 section(s), ~39,748 chars):
### [strength] 3.1 — Training status
| Status | Experience | Sessions/week | Progression model |
|---|---|---|---|
| Beginner | 0–1 year | 2–3 | Linear. Add load, hold everything else stable. |
| Intermediate | 1–3 years | 3–4 | Vary intensity within the week. |
| Advanced | 3+ years | 4–6 | Varied periodization, multi-week cycles required. |

**This roster skews advanced.** Two consequences: linear progression is finished and will not produce results, and the weekly ceiling sits below the general 4–7 recommendation because throwing occupies the same recovery budget.

### [strength] 3.2 — Equipment tier
| Tier | Access |
|---|---|
| E1 | Full weight room — barbells, platforms, racks, dumbbells |
| E2 | Racks and dumbbells, no platform. Cables available to some athletes but **never assumed.** |
| E3 | Bands, med balls, plyo balls, bodyweight |

**Every slot in every template is a movement category with a ranked substitution ladder across E1 → E2 → E3.** A template that names a single exercise is unusable on a roster where equipment varies by athlete and, for some, by week. Cable-based prescriptions carry a mandatory band substitution.

Required form:

> **Slot: Bilateral knee-dominant power**
> E1 — Trap bar jump
> E2 — Dumbbell jump shrug / dumbbell squat jump
> E3 — Band-resisted squat jump / unloaded countermovement jump

### [strength] 3.3 — Readiness gates
Gates are pass/fail entry criteria, not goals. An athlete who has not passed the gate does not get the exercise, regardless of phase. Gate status is stored per athlete and re-verified every 8 weeks.

| Gate | Criterion | How verified remotely |
|---|---|---|
| **G1 — Loaded jumps, advanced plyometrics** | Trap bar deadlift 1.5× bodyweight for 3 at RPE ≤8, **or** front squat at bodyweight for 5 at RPE ≤8 | Video of the qualifying set |
| **G2 — Single-leg plyometrics** | Single-leg stand, quarter squat, and half squat held 30 s each, per side, without loss of position | Video, one continuous clip per side |
| **G3 — Depth jumps and KEAT** | G1 and G2 both passed, plus 4 weeks of progressive plyometric exposure completed, plus no current asymmetry flag (>10%) on any lower-body bilateral test | Video of a 12-inch drop jump showing a quiet landing, no valgus collapse, no heel slam, contact time under 250 ms |
| **G4 — Drop heights above 18 inches** | G3 passed, bodyweight under 220 lb, RSI stable or improving at the current height for 2 consecutive sessions | Video at current height before progression is granted |

**G3 and G4 exist because these methods are trained without a coach present.** The video submission is not optional and is not a formality — it is the only mechanism verifying that the landing, which is the entire stimulus, is being performed correctly. An athlete who does not submit video does not progress in drop height, and a landing that degrades pulls the athlete back one height increment.

---

### [strength] 4.2 — The load table
One table. Replaces the Force-Velocity Zone Guide, the athlete-facing quick guide, and the standalone power-lift prescriptions from the prior document.

| Goal | RPE | RIR | Reps | Sets | Rest | %1RM (reference) |
|---|---|---|---|---|---|---|
| Max strength | 8–9 | 1–2 | 1–5 | 2–6 | 3–5 min | 85–93% |
| Strength-speed | 7–8 | 2–3 | 2–4 | 3–5 | 2–5 min | 75–85% |
| Power — squat/hinge pattern | speed-limited | — | 3–5 | 3–5 | 2–5 min | 55–75% |
| Speed-strength — loaded ballistic | speed-limited | — | 3–5 | 3–6 | 2–3 min | 30–50% |
| Max speed — unloaded ballistic | speed-limited | — | 3–5 | 3–6 | Full | 0–30% / BW |
| Hypertrophy | 8–9 | 1–2 | 6–12 | 3–6 | 30–90 s | 67–85% |
| Tissue tolerance | 7–8 | 3+ | 12+ | 2–3 | <30 s | <67% |

**"Speed-limited" means the set ends when implement speed visibly drops, not when the rep count is reached.** If speed falls off, the set is over and the load comes down next session.

### [strength] 4.3 — Load by exercise class
The prior document carried three peak-power answers held together by hedge notes. They conflicted because **"power" is not one zone** — peak power output is exercise-specific. Load is indexed by exercise class, not by a universal zone.

| Exercise class | Load band | Limiter |
|---|---|---|
| Weighted jumps (trap bar, DB, vest) | 20–40% bodyweight added | Jump height maintained within 10% of unloaded |
| Squat / hinge pattern, power intent | 55–75% | Bar speed |
| Loaded ballistic throws | 30–50% | Implement speed |
| Unloaded jumps, sprints, med ball | BW / 0–30% | Movement speed |

### [strength] 4.5 — Exercise selection and order
**Classes.** *Core* exercises are multi-joint and take priority. *Assistance* exercises are single-joint, generally corrective. *Structural* exercises load the spine directly or indirectly. *Power* exercises are structural movements performed explosively. *Recovery* exercises are low-stress and sit at the end of a session or in a session of their own.

**Order within a session:** power → core strength → assistance → recovery. Alternate upper/lower or push/pull to manage fatigue.

**Front-loading rule:** corrective, CNS, power, and agility work is performed **before** weight training and throwing, not after. Transfer is better when these are frontloaded.

**Muscle balance:** the agonist should not significantly outpace the antagonist. For pitchers this is specifically the accelerator/decelerator relationship at the shoulder, which is why posterior shoulder and scapular work is standing content rather than a phase.

**Cross-pattern selection:** force transfers contralaterally — for a right-handed pitcher, right pec and shoulder girdle work with left oblique, hip flexor, and quad, while left lat and right glute work together. A useful lens when selecting anti-rotation and rotational accessory work.

### [strength] 4.6 — Frequency — the CNS budget
Frequency is not set by lifting alone. **The governing number is total high-CNS exposures per week, and throwing counts.**

**High-CNS:** max-effort lifting (RPE 9+), sprinting, extensive plyometrics, depth jumps and KEAT, ballistic lower-body work, any high-intent throwing day, game appearances.

**Low-CNS:** submaximal lifting (RPE ≤7), crawling and positional work, moderate horizontal jumps, mobility, low-intensity isometrics, zone 2 aerobic work, recovery sessions.

**Standing rules:**

1. Never stack two high-CNS days back to back.
2. Throwing days are high-CNS days when planning lifting.
3. High-CNS lifting does not precede a high-intent throwing day.
4. **An athlete's team lift heavy day is a high-CNS exposure we do not control.** Ask once, store it on the athlete record, treat it as fixed for the season, and program around it.
5. Weekly high-CNS ceiling: 3 off-season, 2 in-season (which for most athletes is consumed entirely by throwing and team lifting).

### [strength] 4.7 — One primary quality per phase
A phase develops one primary quality. Everything else is maintained, not developed. Two primary qualities produces two half-adaptations and a fatigued athlete.

The primary quality is chosen from the 1.3 ranking, filtered by the 2.4 gap diagnostic and the force-velocity profile from 2.3.

### [strength] 4.8 — Progression, deload, and regression
**The RPE 2-for-2 rule.** If a prescribed RPE 8 set comes back at RPE 6 or lower for two consecutive sessions, increase load: 2–5% upper body, 5–10% lower body. The reverse also holds — RPE 10 on a prescribed 8 for two consecutive sessions drops the load and triggers a deload check.

**Deload triggers.** Any two in the same week:

- CMJ height down ≥5% from rolling baseline
- **RSImod down ≥10% from rolling baseline** (more sensitive than height; often fires first)
- Prescribed loads coming in 2+ RPE points higher than programmed
- Resting heart rate elevated ≥5 bpm over baseline for 3+ days
- Reported sleep disruption across multiple nights
- Reported loss of appetite or persistent mood disturbance
- Arm feeling heavy or slow during warm-up on consecutive throwing days
- Velocity down with no mechanical change identified

**Text check-in routing ⚙.** Reporting is informal, so common phrasings route directly:

| What they say | What it means | Action |
|---|---|---|
| "Arm felt heavy warming up" | Incomplete recovery from prior throwing | Drop intent one level. No high-CNS lift that day. |
| "Couldn't finish the last set" | Load mis-set or fatigue accumulating | Check against the reverse 2-for-2 rule. |
| "Dead legs" | Lower-body fatigue, often team lift | Pull ballistic lower-body work. Keep throwing. |
| "Shoulder sore in front" | Mechanics issue | Pull high intent. Review video. |
| "Shoulder or elbow sore in back" | Accelerator/decelerator imbalance | Pull high intent. Audit posterior shoulder and eccentric-column volume. |
| "Elbow sore on the inside" | Medial elbow — treat as serious | Stop throwing. Assess before any return. |
| "Slept badly all week" | Systemic | Count toward deload trigger. |
| "Felt great, want more" | — | Not a reason to add volume. Progress per 2-for-2 only. |

---

### [strength] 5.2 — The governing theory
**Stimulus–fatigue–recovery–adaptation.** The greater the workload, the greater the fatigue and the longer the delay before adaptation appears. As fatigue dissipates, performance rises above baseline. If no new stimulus arrives, detraining follows.

**Fitness–fatigue.** Every session produces both fitness and fatigue. Preparedness is the difference between them. High loads raise fitness *and* fatigue simultaneously, so preparedness drops before it rises. This is why a peak cannot be held: peak performance is sustainable for 1–2 weeks, and attempting to hold it longer produces either fitness loss or overtraining.

**Overtraining continuum:**

| State | Duration | Signs | Response |
|---|---|---|---|
| Acute fatigue | 1–2 days | None, or improved performance | Normal. Continue. |
| Functional overreaching | Days to 1 week | Temporary performance dip | Deload week resolves it. |
| Non-functional overreaching | Weeks to months | Stagnant or declining performance, mood disturbance, degraded coordination | Extended unload. Reassess the whole block. |
| Overtraining syndrome | Months to years | Dramatic performance loss, frequent illness | Refer out. Not a programming problem at this point. |

Causes: large jumps in volume or intensity, and **training monotony** — the same stimulus repeated without variation, which is the failure mode most common in remote programming.

### [strength] 5.3 — The college baseball annual plan
| Period | Months | Phase | Primary quality | Lifting | Throwing |
|---|---|---|---|---|---|
| **Second transition** | Late May–June (or post-summer) | Active rest | None | Optional, unstructured | **None.** Full arm shutdown, 2–4 weeks minimum. |
| **General preparatory** | June–July, or Sept if no summer ball | Hypertrophy / strength endurance / work capacity | Work capacity | 4×/wk, RPE 7–8, 6–12 reps | On-ramp, low intent |
| **Specific preparatory** | August–October | Basic strength | Maximal strength | 4×/wk, RPE 8–9, 2–6 reps | Build intent, drill-heavy |
| **First transition** | November–December | Strength to power | Power / RFD | 3–4×/wk, weighted jumps, KEAT block | Velocity work, weighted balls |
| **Competitive** | February–May | Maintenance | Maintain everything | 2×/wk managed around team lift | Competition |
| **In-season peak** | Conference / postseason | Peaking | Freshness | 1–2×/wk, low volume | Competition |

**Summer ball athletes** compress the general and specific preparatory periods into September–October and treat summer as a second competitive period. They get a shortened first transition and no more than one true velocity block per year. This is a real cost of playing summer ball and should be named to the athlete rather than programmed around silently.

### [strength] 5.4 — Phase prescriptions
| Phase | Load | Sets × reps | Emphasis |
|---|---|---|---|
| Hypertrophy / strength endurance | RPE 7–8 (50–75%) | 3–6 × 8–20 | Lean mass, tissue capacity, work capacity |
| Basic strength | RPE 8–9 (80–93%) | 2–6 × 2–6 | Maximal force in the patterns that matter for throwing |
| First transition | Mixed — heavy and ballistic in the same week | 2–5 × 2–5 | Convert strength to power. **Last week is a deload.** |
| Competitive / maintenance | RPE 7–8 (85–93% on limited volume) | 2–5 × 3–6 | Hold adaptations at minimum volume cost |
| Peaking | RPE 6–8 (50–95%, cycled) | 1–3 × 1–3 | Shed fatigue, preserve fitness. **1–2 weeks maximum.** |

### [strength] 5.5 — Non-linear structure for advanced athletes
This roster is advanced, so linear progression within a block is exhausted. Within a microcycle, vary intensity: one heavy day and one speed day in the same week rather than progressing both together. Light days carry roughly 80% of the heavy day's load.

**Block structure ⚙:** standard mesocycle is 4 weeks — three loading weeks with an ascending profile, then a deload. Deload week drops volume to roughly 50% and holds intensity, which sheds fatigue without shedding fitness.

### [strength] 6.5 — KEAT and shock training
**Kinetic Energy Accumulation Training** uses falling or absorbed forces to develop supramaximal eccentric force. Methods: depth jumps, altitude landings, overspeed eccentrics with bands or releases.

**Why it stays in the system.** Removing the Olympic lifts removes the catch phase, which was one source of force-absorption training. KEAT trains force absorption more directly and at higher magnitude than a clean catch does, and it is the primary trainer of braking rate of force development — the eccentric column's defining quality and one of the better predictors of pitching velocity in the jump literature.

> **"Before you can overcome force, you must absorb it."**

**Entry requirements:** G3 passed (see 3.3). No exceptions, no partial credit, no "he's been lifting a long time."

**Progression ⚙:**

| Step | Drop height | Advancement criterion |
|---|---|---|
| 1 | Altitude landing only (no rebound), 12" | 3 sessions, quiet landing on video, no valgus |
| 2 | Depth jump, 12" | RSI stable or improving across 2 sessions |
| 3 | Depth jump, 18" | RSI stable or improving across 2 sessions; G4 for anything above |
| 4 | Depth jump, 24" | Bodyweight under 220 lb; RSI must **improve** over the 18" value or the athlete stays at 18" |

**Hard limits:**

- Bodyweight over 220 lb: do not exceed 18 inches.
- Ground contact time above 250 ms means the athlete is absorbing rather than rebounding — drop the height.
- RSI that falls when height rises means the height is too high. **The optimal drop height is the tallest box at which RSI is still improving, and it is individual.** This is why RSI is worth measuring.
- Maximum 40 contacts per session for depth jumps specifically, counted inside the 6.4 volume cap.
- High-CNS. Never within 48 hours of a start, never stacked with another high-CNS day.
- Video submission required at every height progression. No video, no progression.

**Placement:** first transition phase (November–December) and, if the calendar allows, a shorter block in the general preparatory period. **Not in-season.**

### [strength] 6.6 — Weighted implement throwing
**Load range: ±20% of a regulation 5 oz baseball. That means 4 oz and 6 oz. Nothing outside that window.**

**Basis.** The ±20% under/overload window traces to DeRenne's work on weighted-implement throwing, which found velocity gains from paired under/overload training within a narrow load range. Two independent lines of evidence support the narrow window:

1. Loading heavier than 6 oz when training for arm speed specifically is unlikely to help arm speed, mechanical efficiency, or joint health.
2. The sprint literature finds that external load which reduces movement velocity by more than 10–12% becomes counterproductive for developing speed. The same logic applies to throwing, and 7 oz exceeds that threshold.

> **Supersession notice.** This replaces the 3 oz / 7 oz protocol carried in the Hacking the Kinetic Chain working notes. Those loads sit at ±40% and are outside the supported window. Any template referencing 3 oz or 7 oz implements is out of date and should be rebuilt against this section.

**Testing protocol.** Establish min, max, and average velocity for each implement:

| Implement | Throws |
|---|---|
| 5 oz baseball | 1 @ 80% RPE, 2 @ 100% RPE |
| 6 oz | 1 @ 80% RPE, 2 @ 100% RPE |
| 5 oz baseball | 2 @ 100% RPE |
| 4 oz | 1 @ 80% RPE, 2 @ 100% RPE |

**Training protocol.** Same sequence, 3–4 throws at 100% RPE per implement. **Terminate the session early when velocity drops 4% below the tested average.** This is the auto-regulation rule and it is not optional — it is what keeps a velocity session from becoming a fatigue session.

**Frequency:** 2–3× per 14 days in a velocity block. Never in-season for a starter without removing an equivalent high-intent exposure elsewhere.

### [strength] 8.4 — Arm care volume — the computable formula
**Lineage note.** This formula originates with Tom House and the NPA as a joint-integrity minimum. The original form is:

```
pitches/week × V² × 0.01 × (1/0.8) × (1/0.8)
```

which is mathematically identical to the form long carried in this document, since 1/0.8 = 1.25. In the original NPA framework the two 1.25 factors were **not constants** — they represented an athlete-specific mechanical efficiency factor and a strength-loss factor. NPA's own example: a pitcher whose mechanics are 88% efficient needs to be 12% stronger to handle his competitive pitch totals. This system applies them as flat 1.25 values across the roster, which is a simplification. Revisit if individual efficiency assessment becomes available.

**The problem with the formula as previously carried:** it produced a target in foot-pounds with no procedure for converting a set/rep/load prescription into foot-pounds, and no definition of which exercises counted. That made it unfalsifiable — nothing could check compliance. Below is the conversion.

**Step 1 — compute the weekly target.**

```
target_ft_lb = pitches_per_week × (avg_velocity_mph)² × 0.01 × 1.25 × 1.25
```

Off-season substitutes high-effort throws per week for pitches per week.

*Worked example:* 80 pitches/week at 88 mph average.
`80 × 7744 × 0.01 × 1.5625 = 9,680 ft-lb per week`

**Step 2 — compute the volume-load of each qualifying exercise.**

A foot-pound is force × distance. This is the standard volume-load calculation:

```
exercise_ft_lb = load_lb × displacement_ft × reps × sets × sessions_per_week
```

**Step 3 — apply the qualifying exercise rule.** This is the piece that was missing, and without it the formula is meaningless in either direction.

**Qualifying:** exercises where the arm, shoulder girdle, or forearm musculature is the prime mover **and** the load is a fixed, known weight. Dumbbell, cable, wrist weight, and machine work for the rotator cuff, scapular stabilizers, deltoids, elbow flexors and extensors, and forearm.

**Not qualifying:**
- **Bands.** Tension is variable through the range and not a known load. Band work is valuable and stays in the program, but it does not count toward the target. (Counting it would let a band series satisfy the entire weekly requirement, which defeats the purpose.)
- **Bodyweight compound pulling** — pull-ups, rows with bodyweight. The load cannot be attributed to the arm and shoulder specifically. A 180 lb athlete doing three sets of eight pull-ups generates over 8,000 ft-lb on paper, which would clear almost any target by itself and render the audit useless.
- **Throwing itself.**

**Step 4 — displacement reference table ⚙**

| Movement | Displacement per rep |
|---|---|
| DB external rotation at 90° | 1.3 ft |
| DB internal rotation at 90° | 1.3 ft |
| Prone Y raise | 2.0 ft |
| Prone T raise | 2.0 ft |
| Prone W / prone row | 1.2 ft |
| Side-lying ER | 1.2 ft |
| DB overhead press | 1.8 ft |
| Tricep extension | 1.5 ft |
| Bicep curl | 1.3 ft |
| Wrist flexion / extension | 0.8 ft |
| Forearm pronation / supination | 1.0 ft |
| Wrist weight series (per rep, long arc) | 3.0 ft |

**Step 5 — worked compliance check**

Target: 9,680 ft-lb/week.

| Exercise | Load | Disp. | Sets × reps | Sessions | ft-lb |
|---|---|---|---|---|---|
| DB ER at 90° | 5 lb | 1.3 | 3 × 15 | 3 | 878 |
| DB IR at 90° | 5 lb | 1.3 | 3 × 15 | 3 | 878 |
| Prone Y | 5 lb | 2.0 | 3 × 12 | 3 | 1,080 |
| Prone T | 5 lb | 2.0 | 3 × 12 | 3 | 1,080 |
| Prone W | 10 lb | 1.2 | 3 × 12 | 3 | 1,296 |
| Wrist weight series | 1 lb | 3.0 | 3 × 30 | 4 | 1,080 |
| Wrist flexion/extension | 10 lb | 0.8 | 3 × 15 | 3 | 1,080 |
| Tricep extension | 20 lb | 1.5 | 3 × 12 | 2 | 2,160 |
| **Total** | | | | | **9,532** |

That lands just under target, meaning this athlete needs one more exercise or slightly more volume — for example adding a DB overhead press at 25 lb × 1.8 ft × 3 × 8 × 2 sessions (2,160 ft-lb) clears it comfortably.

**Step 6 — how to use the result.**

**This is an audit, not a prescription.** It does not tell you which exercises to program. It tells you whether the arm care volume you programmed is adequate for the throwing volume the athlete is carrying. Compute the target, sum the program, check that it clears. If it does not, the arm is being asked to do more work than it is being prepared for.

**Implementation:** compute both numbers on the athlete dashboard, show them side by side, and flag when programmed volume falls below target for two consecutive weeks. That flag is the useful output — not the raw number.

---

### [strength] 9.1 — Template structure
Templates are **parameterized**, not prose. Every template declares which elements are locked and which are editable, so that a weekly adjustment made in chat cannot silently break the CNS spacing or the volume caps.

```
Template
├── locked[]           # cannot be changed by weekly edit
│   ├── day_cns_classification
│   ├── high_cns_day_count
│   ├── session_order (power → strength → assistance → recovery)
│   ├── arm_care_floor
│   └── active_readiness_gates
├── editable[]         # adjustable per week
│   ├── slot.exercise (within substitution ladder only)
│   ├── slot.sets
│   ├── slot.reps
│   ├── slot.rpe_target
│   └── session.day_of_week (subject to locked CNS rules)
└── slots[]
    └── Slot
        ├── movement_category
        ├── goal (maps to 4.2 load table)
        └── substitution_ladder: {E1, E2, E3}
```

**Validation rules that run on every edit ⚙:**

1. High-CNS days per week must not exceed the 4.6 ceiling (3 off-season, 2 in-season).
2. No two high-CNS days adjacent.
3. No high-CNS lift within 24 h before a high-intent throwing day or a start.
4. No high-CNS lift within 24 h of `team_lift_heavy_day`.
5. Plyometric contacts per session must not exceed the 6.4 cap for the athlete's training status.
6. Any slot requiring a gate the athlete has not passed is rejected, with the gate named.
7. Exercise substitutions must come from that slot's ladder. Free-text exercises are rejected.
8. Arm care floor (8.4) must still be met after the edit.

A failed validation returns the rule that failed and the nearest legal alternative. It does not silently adjust.

### [strength] 9.3 — Off-season week — general preparatory
Primary quality: work capacity. 4 lifts, 2 high-CNS days.

| Day | CNS | Session |
|---|---|---|
| Mon | **High** | Lift A — bilateral knee strength, upper push, upper pull, anti-rotation. RPE 7–8, 8–12 reps. Phosphagen conditioning. |
| Tue | Low | Throwing (low intent). Arm care. Zone 2 30 min. |
| Wed | Low | Lift B — hip-dominant, unilateral, posterior shoulder. RPE 7, 10–15 reps. |
| Thu | **High** | Throwing (moderate intent). Anaerobic conditioning. |
| Fri | Low | Lift C — upper emphasis, rotational, arm care. RPE 7–8. |
| Sat | Low | Zone 2 30–45 min. Mobility. |
| Sun | Off | — |

### [strength] 9.4 — Off-season week — specific preparatory
Primary quality: maximal strength. 4 lifts, 3 high-CNS days.

| Day | CNS | Session |
|---|---|---|
| Mon | **High** | Lift A — bilateral knee strength RPE 8–9, 3–5 reps. Upper push heavy. |
| Tue | Low | Throwing (moderate). Arm care. Isometrics. |
| Wed | **High** | Lift B — hip-dominant heavy RPE 8–9, 3–5 reps. Upper pull heavy. |
| Thu | Low | Zone 2. Mobility. Posterior shoulder. |
| Fri | **High** | Throwing (high intent). Lift C — light, RPE 7, movement quality. |
| Sat | Low | Anaerobic conditioning. Arm care. |
| Sun | Off | — |

### [strength] 9.5 — Off-season week — first transition (power / KEAT block)
Primary quality: power and RFD. 3 lifts, 3 high-CNS days. **This is where depth jumps and weighted ball work live.**

| Day | CNS | Session |
|---|---|---|
| Mon | **High** | Weighted jumps (speed-limited). Depth jumps — G3/G4 gated, ≤40 contacts. Lift A: strength maintenance RPE 8, 2–3 reps. |
| Tue | Low | Arm care. Isometrics. Zone 2 20 min. |
| Wed | **High** | Throwing — velocity day. Weighted balls 4/5/6 oz per 6.6. Terminate at 4% velocity drop. |
| Thu | Low | Lift B — upper emphasis, RPE 7. Posterior shoulder. Mobility. |
| Fri | **High** | Ballistic lower — lateral and horizontal power. Lift C: RPE 7–8, speed-limited. |
| Sat | Low | Zone 2. Arm care. |
| Sun | Off | — |

**Week 4 of this block is a deload:** volume to ~50%, intensity held, depth jumps removed entirely.

### [throwing] 12.1 — Intent scale
**This is an instruction scale, not a load scale.** The percentages describe what you tell the athlete to do. They do not describe what his arm receives, and the gap between the two is large.

| Level | Name | Instruction | Used for | CNS (§4.6) |
|---|---|---|---|---|
| I1 | Recovery | "Easy" | Recovery throwing, post-outing | Low |
| I2 | Low | "50%" | Mechanical work, drill acquisition, light long toss | Low |
| I3 | Moderate | "75%" | Catch play, medium long toss, skill development | Low |
| I4 | High | "Let it go" | Velocity development, competitive throwing | **High** |
| I5 | Max | "Max" | Pulldowns, velocity testing, competition | **High** |

**I4 and I5 count against the weekly high-CNS ceiling in §4.6.** This is the link between the throwing program and the lifting program, and it is the rule most often broken by accident.

### [throwing] 12.1a — What reduced effort actually delivers — and why it changes the volume math
Pitchers do not scale down the way the instruction implies, and this is one of the better-replicated findings in the throwing literature.

| Instruction | Ball velocity produced | Elbow varus torque produced |
|---|---|---|
| "50% effort" | ~78–86% of max | ~75–87% of max |
| "75% effort" | ~86–90% of max | ~81–93% of max |

Sources: Melugin, Larson, Fleisig, Conte, Fealy, Dines, D'Angelo & Camp (*OJSM*, 2019) — 60 HS and collegiate pitchers, motus sleeve, 120 ft long toss. Hyeamang, Dowling, Hodakowski et al. (*OJSM*, 2026) — 38 HS and 24 professional pitchers, 3D motion capture at 480 Hz. Both found perceived effort correlated strongly with measured torque (R² > 0.85) while the *magnitude* of reduction never matched the instruction. Roughly: every 25% drop in stated effort buys about 7% less torque and 11% less velocity.

**Three consequences for this system ⚙**

1. **Throw count, not intent, is the unit of arm-load accounting.** Sixty drill throws at I2 delivers most of the elbow load of sixty throws at I5. Low intent buys mechanical control and attentional bandwidth. It does not buy an unloaded arm.
2. **Drill volume must be counted.** Every throw above catch-play distance enters the weekly budget in §15.2 regardless of the intent it was prescribed at. A movement-change block is not free.
3. **Return-to-throw cannot be controlled by effort percentage alone** (§18.3). Distance, throw count, and rest interval are the controllable variables. "Throw at 50%" is an instruction, not a dose.

**What low intent is still for:** motor learning. A pattern installed at I2 is installed because attention is available, not because the arm is protected. Both things are true at once and the document should say so.

### [throwing] 12.2 — Throwing status
| Status | Description | Weekly I4/I5 ceiling |
|---|---|---|
| Building | Off-season, on-ramping, or returning | 1 |
| Developing | Full off-season capacity | 2 |
| Competing | In-season | 2, usually consumed by outings |
| Restricted | Post-injury or §17 flag active | 0 |

### [throwing] 12.3 — Gates — what has to be true before a guy is allowed to do something
Four checkpoints. Each one is a question with a yes-or-no answer. If the answer is no, he doesn't do the thing yet.

**Before he throws hard at all (I4 or I5):**
- No red flag currently active from §17 (pain, velocity loss, location loss)
- Shoulder range of motion passes the §2.6 check
- He's completed an on-ramp — he's been throwing consistently, not coming off a layoff

**Before he touches weighted balls:**
- Everything above is true
- Plus he's had at least 4 weeks of steady throwing at moderate intent or higher

Weighted implements are not how you get someone back into throwing shape. They're for an arm that's already in shape.

**Before pulldowns or velocity testing:**
- Everything above is true
- And it's the off-season, or he's in a designated velocity block

Not during the season. A pulldown day and a start in the same week is two max-effort exposures.

**Before installing a new mechanical change at high intent:**
- He's already gotten that change through Stage 3 (see §13.5)

You can't teach a new pattern and throw hard at the same time. The pattern has to survive mixed practice at moderate intent first.

### [throwing] 13.7 — One change at a time — hard rule
**One mechanical change is active per athlete at any time. Never two.**

Two reasons, and the second is the one that matters: with two changes running you cannot attribute the result, so you learn nothing from either outcome. And the athlete cannot hold two attentional targets at competitive intent — at I4 and above he gets one, and if you gave him two he will pick one himself and you won't know which.

**"Continuously refining" means a continuous queue of single changes**, each run through the four stages to completion. It does not mean multiple simultaneous changes, and it does not mean a new cue every session.

The platform should enforce this: one `active_change` per athlete, with the rest held in a ranked queue from §11.4.

### [throwing] 14.6 — Velocity development — what actually drives it
**The mechanism, stated honestly.** The cause of weighted-ball velocity gain is not settled. Driveline's own published work states there is no conclusive evidence explaining it and that the "builds arm strength" explanation is likely wrong. What the evidence does support:

1. **Increased shoulder external rotation (layback).** Reinold et al. (2018) ran a 6-week weighted-ball program: velocity rose, and so did passive shoulder ER. **4 of 17 in the training group sustained elbow injuries** — 2 during the program, 2 the following season — against 0 in the control group. Greater layback lengthens the acceleration path and stores more elastic energy. It is also the §1.5 trade-off in a different costume: the adaptation producing the velocity is the adaptation producing the risk.
2. **Altered arm kinematics.** Weighted implements shift maximum shoulder internal rotation velocity, elbow extension velocity, and the timing of max external rotation. Internal rotation and elbow extension are the primary contributors to ball velocity, so the implements are training the right variables.

**So the gain is partly neural and partly tissue, and the tissue part carries the injury.** Any program using weighted implements should be monitoring shoulder ROM (§2.6) specifically because that is the adaptation being induced.

### [throwing] 14.7 — Constrained positions do not reduce arm stress
**This corrects a widely held assumption, including one previously carried in this document.**

The intuition is that removing the lower half lowers the load on the arm. The measurements say otherwise:

- **Towel drills** — a more constrained task than any throw in Phase 1 — produced elbow valgus torque reaching **roughly 80% of full-effort active throwing.**
- **Squatting throws in catchers** showed **no difference** in medial elbow torque compared with standing throws.
- **Kibler & Chandler:** a 20% reduction in kinetic energy transfer from hip and trunk requires a **34% increase in shoulder rotational velocity** to produce equivalent arm force.

**Removing the legs does not unload the arm. It transfers the demand to the arm.**

**Consequences ⚙**

| Claim | Status |
|---|---|
| Two-knee and one-knee throws are low-stress | **False.** They are low-*velocity*, which is not the same thing. |
| Constrained drills are a safe way to add volume | **False.** They enter the §15.2 ledger at full weight. |
| You can build top-end arm speed from a constrained position | **No.** The position caps producible arm speed, and arm speed you cannot produce is arm speed you cannot train. |
| Constrained positions are valuable | **Yes — for motor learning.** They free attention and reduce degrees of freedom. That is the entire benefit and it is a real one. |

This is the same finding as §12.1a reached by a different route: **the things that feel like they lower arm load mostly lower velocity instead.**

### [throwing] 14.10 — Prescribing velocity work intelligently
Three modalities develop top-end velocity. They are not interchangeable and they are not equally risky.

| Modality | Trains | Arm cost | Constraints |
|---|---|---|---|
| **High-intent long toss** | Arm speed, whole-chain output | High | I4. Auto-regulated per §14.5. |
| **Weighted implements (4/5/6 oz)** | IR velocity, elbow extension velocity, layback | High, and induces the ROM change in §14.6 | §6.6 protocol. 4% termination rule. Monitor ROM per §2.6. |
| **Pulldowns** | Peak velocity expression | **Lower than assumed** — ASMI and Driveline both found slower arm speed in pulldowns than mound pitching, at comparable elbow torque | Gate T3. Off-season or velocity block only. |

**On pulldowns specifically.** The assumption that pulldowns are the highest-stress throw is not supported. The run-up's linear momentum appears to substitute for arm speed rather than add to it. **The risk in pulldowns is volume and frequency, not the movement.**

**Intelligent pulldown rules ⚙**

1. Gate T3 required — off-season or a designated velocity block, never in-season.
2. Maximum **1 pulldown session per 14 days.**
3. Maximum **8–12 max-effort pulldowns per session**, after a full long-toss build-up.
4. Terminate on the §6.6 rule: 4% below tested average.
5. Never within 48 h of another high-CNS exposure.
6. **Never the primary velocity modality.** Pulldowns measure and express velocity. Long toss and weighted implements build it.
7. Shoulder ROM re-checked (§2.6) within 72 h of any pulldown or weighted-implement session.

**The honest summary:** you cannot build top-end velocity in a low-stress position, because the velocity and the stress arise from the same thing — high arm speed. What you can do is control how often you visit it, terminate on fatigue rather than rep count, and monitor the ROM change that is the actual mechanism of both the gain and the risk.

---

### [throwing] 15.2 — Arm load accounting
**The unit is a throw, weighted by implement. Not intent** (§12.1a).

**Counts:** every throw beyond warm-up catch distance — drill throws, constrained-position throws, long toss, flat grounds, bullpens, competitive pitches, pulldowns.

**Does not count:** warm-up catch inside 60 feet at I1, dry reps (§14.8), med ball work (§14.9), non-throwing arm care.

**Implements — 5 oz standard, no plyo balls**

| Implement | Multiplier |
|---|---|
| 5 oz (standard) | 1.0 |
| 4 oz | 1.1 |
| 6 oz | 1.1 |
| Football, javelin, softball, frisbee (Phase 3) | 0.8 |

**Constrained-position throws count at full weight** (1.0), per §14.7. A two-knee throw is not a discounted throw.

### [throwing] 15.2a — Where the weekly budget comes from — and why it isn't a number
**Straight answer: there is no published weekly throw budget for college pitchers, and any absolute number offered here would be invented.** Pitch-count guidelines that do exist (Pitch Smart and similar) are per-outing limits for youth and high school arms, derived from injury-surveillance work at those ages. They do not extend to a college pitcher's total weekly throwing across drills, long toss, and bullpens, and nobody has established what that ceiling is.

So the system does not use an absolute ceiling. **It uses a rate-of-change rule instead**, which requires knowing only the athlete's own history:

```
acute_load   = weighted throws, trailing 7 days
chronic_load = average weekly weighted throws, trailing 28 days
ratio        = acute_load / chronic_load
```

| Ratio | Reading | Action |
|---|---|---|
| < 0.8 | Undertrained relative to recent history | Load can rise |
| 0.8 – 1.3 | Appropriate progression | Proceed |
| 1.3 – 1.5 | Spike forming | Flag. Hold volume flat next week. |
| > 1.5 | Sharp spike | Reduce. Do not add intent this week. |

**Why this is better than a number I made up:** it needs no population norm, it is athlete-relative, and it directly targets the thing that actually tracks with injury — a rapid increase relative to what the athlete is conditioned for, rather than a high absolute total. A pitcher built up to 400 throws a week is safer at 400 than an unconditioned one is at 250.

**Stated limitation:** the acute-to-chronic ratio has been criticised on methodological grounds and the specific cut points are conventions, not hard thresholds. Treat the ratio as a **flag that prompts a look**, not as a verdict. What it reliably catches is the case this system is most likely to produce — a movement-change block quietly doubling a guy's weekly throws because drill throws don't feel like work.

**Requirement:** the ratio needs 28 days of logged history before it means anything. Until then, hold weekly volume roughly flat and build the baseline.

### [throwing] 16.1 — Annual structure
Volume is expressed as a direction of travel rather than an absolute, per §15.2a — the controlling rule is the acute-to-chronic ratio, not a weekly ceiling.

| Period | Months | Status | Volume | Emphasis | Implements | Velocity work |
|---|---|---|---|---|---|---|
| **Second transition** | Late May–June | Restricted | **Zero.** Full shutdown, 2–4 weeks min. | None | None | None |
| **General preparatory** | June–July (or Sept without summer ball) | Building | Rebuild chronic load from zero. Ratio ≤1.3 every week. | Constrain, Time | 5 oz only | None |
| **Specific preparatory** | Aug–Oct | Developing | Steady build | Adapt, Move | 5 oz; cross-training implements in Phase 3 | Long toss building to I4 |
| **First transition** | Nov–Dec | Developing | Peak weekly volume | Bounce, Move, **Compete** | 4/5/6 oz per §6.6 | **Velocity block.** Pulldowns per §14.10. |
| **Competitive** | Feb–May | Competing | Held flat | Compete | 5 oz only | None |

**On the on-ramp out of shutdown:** coming off 2–4 weeks of zero, chronic load is zero and *any* throwing is an infinite ratio. Suspend the ratio rule for the first 3 weeks back and rebuild on a fixed schedule — roughly 25–30% of prior typical weekly volume in week one, adding about 25% per week — then let the ratio take over once 28 days of history exists.

**Compete moves into the first transition**, per §14.2. That is where a change gets tested at full intent while there is still time to respond to what you find.

### [throwing] 17.2 — Red flags — stop throwing
Throwing stops immediately and does not resume until assessed:

- **Medial elbow pain.** Any. Treat as serious until proven otherwise.
- Pain that is sharp rather than sore
- Pain that persists more than 48 hours after an outing
- Pain accompanied by loss of velocity or loss of location
- Numbness or tingling into the hand
- A reported "pop," "give," or "slip"
- Loss of total shoulder rotational motion beyond the §2.6 criterion

A red flag sets throwing status to **Restricted** (§12.2), which zeroes the I4/I5 ceiling and closes gates T1 through T4.

### [throwing] 19.1 — Structure
Same parameterization as §9.1. Locked elements cannot be changed by a weekly edit; editable elements can.

```
ThrowingTemplate
├── locked[]
│   ├── session_intent_cap
│   ├── weekly_I4_I5_count (per §12.2)
│   ├── session_flow_order (§14.4)
│   ├── active_change_count = 1 (§13.7)
│   ├── feedback_schedule (per §13.5 stage)
│   └── active_gates (§12.3)
├── editable[]
│   ├── drill_selection (within the routed phase only)
│   ├── throw_counts
│   ├── distance_targets
│   └── session.day_of_week (subject to locked CNS rules)
└── slots[]
    └── Slot { phase, drill, throws, intent_level, implement }
```

**Validation on every edit ⚙**

1. Weekly weighted throw total must not exceed the §15.2 budget for the athlete's status.
2. I4/I5 sessions must not exceed the §12.2 ceiling.
3. No I4+ throwing within 48 h of another I4+ exposure or of a high-CNS lift (§4.6).
4. Drill selection must come from the phase the athlete is routed to in §14.3.
5. Only one `active_change` per athlete.
6. Intent cap must match the current §13.5 stage — a Stage 1 change cannot be prescribed at I4.
7. Phase 5 (Bounce) requires gate G2; hop throws count against the §6.4 plyometric cap.
8. Any gate-failing slot is rejected, with the gate named.

A failed validation returns the rule that failed and the nearest legal alternative. It never silently adjusts.

(NOTE: 4 section(s) omitted to stay under the 40,000-character prompt budget: throwing 16.4, throwing 19.2, throwing 19.3, throwing 19.4.)

Write next week's program by day and category (Pre-Throwing, Throwing, Post-Throwing, Speed/Power, Main Exercises, Accessory, Recovery). Use format: "Exercise Name SxR @ X%"
````
