import { EngineAthleteState, EngineSlot, RuleResult } from './types'

// athleteState isn't used -- deprecation is a property of the exercise itself, not the
// athlete -- but the (athleteState, slot) signature is kept consistent across every rule in
// this module so the validator can call them uniformly without special-casing one.
export function checkDeprecated(_athleteState: EngineAthleteState, slot: EngineSlot): RuleResult {
  if (!slot.exercise.deprecated) return { ok: true }
  return { ok: false, reason: `"${slot.exercise.name}" is deprecated and can no longer be added to new programs.` }
}
