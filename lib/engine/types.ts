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
