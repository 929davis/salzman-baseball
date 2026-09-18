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
    expect(c.weekly_high_cns_committed).toBe(4)
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
