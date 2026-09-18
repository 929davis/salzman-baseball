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
