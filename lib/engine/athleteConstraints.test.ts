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
  active_change: null, active_change_stage: null,
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
