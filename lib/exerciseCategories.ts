// Single source of truth for exercise program categories — their names, display colors, and
// crucially, their SEQUENCE. Both the coach's program builder and the athlete's program view
// render categories by iterating this same list, so reordering it here reorders the actual
// layout everywhere at once.
//
// "Speed/Power" was previously called "Conditioning" — every exercise ever tagged with it
// (jumps, sprints, explosive med-ball throws) is High-CNS explosive work, not steady-state or
// interval conditioning (which doesn't exist anywhere in this exercise library). Renamed to
// be honest about what it actually is, and moved up in the sequence: explosive nervous-system
// work belongs early in a session while fresh, not after the lift where it was previously
// slotted last. Placed after Throwing/Post-Throwing (not before) — on a day that includes
// both, throw first with a fully fresh arm, then do jumps/sprints, then lift.
export const CATEGORY_ORDER = [
  'Pre-Throwing', 'Throwing', 'Post-Throwing', 'Speed/Power', 'Main Exercises', 'Accessory', 'Recovery',
] as const
export type ExerciseCategory = typeof CATEGORY_ORDER[number]

export const CATEGORY_COLORS: Record<ExerciseCategory, { color: string, bg: string, border: string }> = {
  'Pre-Throwing': { color: '#38bdf8', bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.35)' },
  'Throwing': { color: '#39d353', bg: 'rgba(57,211,83,0.10)', border: 'rgba(57,211,83,0.35)' },
  'Post-Throwing': { color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.35)' },
  'Speed/Power': { color: '#58a6ff', bg: 'rgba(88,166,255,0.10)', border: 'rgba(88,166,255,0.35)' },
  'Main Exercises': { color: '#e8b84b', bg: 'rgba(232,184,75,0.10)', border: 'rgba(232,184,75,0.35)' },
  'Accessory': { color: '#a371f7', bg: 'rgba(163,113,247,0.10)', border: 'rgba(163,113,247,0.35)' },
  'Recovery': { color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.35)' },
}
