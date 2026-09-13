// Pitch Smart (MLB / USA Baseball, developed with ASMI research) rest-day guidance --
// replaces the old "foot-pounds recovery target" model, which had no basis in actual
// research (see lib/armCare.ts's removed calcArmCare for what this replaced).
//
// This roster is primarily college-age, so this uses Pitch Smart's 19-22 bracket specifically
// -- not the youth tables, which use different (lower) thresholds.
//
// Source: mlb.com/pitch-smart/pitching-guidelines/ages-19-22, cross-checked against two
// independent secondary summaries of the same table (the primary page blocks direct
// fetching). The 61-80 / 81-105 / 106+ tiers are confirmed by both. Pitch Smart's public
// materials do not appear to publish graduated sub-61 tiers for this age bracket the way they
// do for youth ages (which step through 0/1/2/3/4 days starting from very low counts) -- if
// you find an official sub-61 breakdown published somewhere, update this; until then, this
// treats anything at or under 60 pitches as requiring 0 mandatory rest days, consistent with
// what both sources show.
export type RestTier = { maxPitches: number, restDays: number }

export const DAILY_MAX_PITCHES = 120 // ages 19-22, single-game/outing max

export const REST_TABLE: RestTier[] = [
  { maxPitches: 60, restDays: 0 },
  { maxPitches: 80, restDays: 3 },
  { maxPitches: 105, restDays: 4 },
  { maxPitches: Infinity, restDays: 5 },
]

export function restDaysRequired(pitchCount: number | null | undefined): number {
  if (pitchCount == null || pitchCount <= 0) return 0
  const tier = REST_TABLE.find(t => pitchCount <= t.maxPitches)
  return tier ? tier.restDays : REST_TABLE[REST_TABLE.length - 1].restDays
}

// Days still owed before this pitcher should throw again, given their most recent logged
// outing. 0 means clear to throw. Negative rest-days-since is impossible (dates are in the
// past), so this always returns >= 0.
export function daysUntilClearToThrow(lastPitchCount: number | null | undefined, lastPitchDateISO: string | null | undefined): number {
  if (!lastPitchDateISO) return 0
  const required = restDaysRequired(lastPitchCount)
  if (required === 0) return 0
  const last = new Date(lastPitchDateISO + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysSince = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, required - daysSince)
}

// Additional Pitch Smart guidance not modeled as a computed guardrail -- this app doesn't
// track game appearance dates precisely enough to check "3 consecutive days" reliably, and an
// annual off-season window is a season-level policy, not a per-pitcher calculation. Surfaced
// as reference text instead of a false-precision computation.
export const PITCH_SMART_NOTES = [
  'No pitcher should appear in a game as a pitcher on 3 consecutive days, regardless of pitch count.',
  'At least 3 months off from competitive pitching per year, including at least 4 continuous weeks of no throwing at all.',
]
