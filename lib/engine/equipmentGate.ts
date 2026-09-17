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
