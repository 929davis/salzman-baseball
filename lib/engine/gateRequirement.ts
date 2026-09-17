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
