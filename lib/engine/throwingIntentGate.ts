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
