// At-Bat Anchor Model — extends the pitch-vs-previous-pitch Effective Velocity test
// (lib/effectiveVelocity.ts) to a hitter's "anchor speed" built from everything he's swung
// at so far THIS at-bat, not just the one pitch before. Two parallel anchor definitions are
// computed server-side (scripts/aggregate-base-scenario.mjs's computeAnchorPairs) and kept
// side by side here rather than picked between in advance:
//   running_avg — average EV of every prior swing this at-bat
//   mode        — the EV tier (nearest 3mph) the hitter has swung at most often this at-bat
// Takes don't update either anchor (a take tells us nothing about where his timing was) —
// a pitch with no prior swing this at-bat has no anchor and is excluded entirely upstream,
// not defaulted to zero.

import { meanCI, wilsonCI, MIN_RENDER_N, type CIResult, type WilsonResult } from './baseScenario'

export type AnchorType = 'running_avg' | 'mode'

export type AnchorPairRow = {
  anchor_type: AnchorType
  anchor_diff_bucket: number
  n: number
  n_whiff: number
  n_whiff_high: number
  n_whiff_middle: number
  n_whiff_low: number
  n_out_of_zone: number
  n_chase: number
  n_in_play: number
  n_hard_hit: number
  n_barrel: number
  n_pull: number
  n_center: number
  n_oppo: number
  n_pull_ground_ball: number
  sum_pull_gb_run_exp: number
  sum_pull_gb_run_exp_sq: number
  n_strikeout_looking: number
  n_strikeout_swinging: number
  sum_delta_run_exp: number
  sum_delta_run_exp_sq: number
}

type RawAgg = Omit<AnchorPairRow, 'anchor_type' | 'anchor_diff_bucket'>
const emptyAgg = (): RawAgg => ({
  n: 0, n_whiff: 0, n_whiff_high: 0, n_whiff_middle: 0, n_whiff_low: 0,
  n_out_of_zone: 0, n_chase: 0, n_in_play: 0, n_hard_hit: 0, n_barrel: 0,
  n_pull: 0, n_center: 0, n_oppo: 0, n_pull_ground_ball: 0,
  sum_pull_gb_run_exp: 0, sum_pull_gb_run_exp_sq: 0,
  n_strikeout_looking: 0, n_strikeout_swinging: 0,
  sum_delta_run_exp: 0, sum_delta_run_exp_sq: 0,
})
const addAgg = (a: RawAgg, r: AnchorPairRow): RawAgg => ({
  n: a.n + r.n,
  n_whiff: a.n_whiff + r.n_whiff, n_whiff_high: a.n_whiff_high + r.n_whiff_high,
  n_whiff_middle: a.n_whiff_middle + r.n_whiff_middle, n_whiff_low: a.n_whiff_low + r.n_whiff_low,
  n_out_of_zone: a.n_out_of_zone + r.n_out_of_zone, n_chase: a.n_chase + r.n_chase,
  n_in_play: a.n_in_play + r.n_in_play, n_hard_hit: a.n_hard_hit + r.n_hard_hit, n_barrel: a.n_barrel + r.n_barrel,
  n_pull: a.n_pull + r.n_pull, n_center: a.n_center + r.n_center, n_oppo: a.n_oppo + r.n_oppo,
  n_pull_ground_ball: a.n_pull_ground_ball + r.n_pull_ground_ball,
  sum_pull_gb_run_exp: a.sum_pull_gb_run_exp + r.sum_pull_gb_run_exp,
  sum_pull_gb_run_exp_sq: a.sum_pull_gb_run_exp_sq + r.sum_pull_gb_run_exp_sq,
  n_strikeout_looking: a.n_strikeout_looking + r.n_strikeout_looking,
  n_strikeout_swinging: a.n_strikeout_swinging + r.n_strikeout_swinging,
  sum_delta_run_exp: a.sum_delta_run_exp + r.sum_delta_run_exp,
  sum_delta_run_exp_sq: a.sum_delta_run_exp_sq + r.sum_delta_run_exp_sq,
})

export type AnchorStat = {
  label: string
  n: number
  // Sign convention matches the rest of the app: delta_run_exp is from the BATTING team's
  // perspective, so a lower runValue is better for the pitcher.
  whiffRate: WilsonResult | null        // of all pitches in this bucket
  chaseRate: WilsonResult | null        // of pitches out of the zone
  hardHitRate: WilsonResult | null      // of balls in play
  barrelRate: WilsonResult | null       // of balls in play
  runValue: CIResult | null             // of all pitches in this bucket
  kLookingRate: WilsonResult | null     // of all pitches in this bucket
  kSwingingRate: WilsonResult | null    // of all pitches in this bucket
  // Timing read — only meaningful for contact (hc_x/hc_y require a ball actually in play):
  // pulled = early, center = on-time, opposite field = late.
  pullRate: WilsonResult | null         // "Early" — of balls in play
  centerRate: WilsonResult | null       // "On-Time" — of balls in play
  oppoRate: WilsonResult | null         // "Late" — of balls in play
  // The specific pattern asked about: pull-side rollover ground balls, and whether they're
  // actually low-value (via their own real run value, not an invented xBA cutoff).
  pullGroundBallRate: WilsonResult | null   // of balls in play
  pullGroundBallRunValue: CIResult | null   // of just that subset
  // Miss location for whiffs — no contact, so no pull/center/opposite read; vertical zone
  // location of the pitch he missed instead.
  whiffHighRate: WilsonResult | null    // of whiffs
  whiffMiddleRate: WilsonResult | null  // of whiffs
  whiffLowRate: WilsonResult | null     // of whiffs
}

function toStat(label: string, a: RawAgg): AnchorStat {
  return {
    label, n: a.n,
    whiffRate: a.n >= MIN_RENDER_N ? wilsonCI(a.n_whiff, a.n) : null,
    chaseRate: a.n_out_of_zone >= MIN_RENDER_N ? wilsonCI(a.n_chase, a.n_out_of_zone) : null,
    hardHitRate: a.n_in_play >= MIN_RENDER_N ? wilsonCI(a.n_hard_hit, a.n_in_play) : null,
    barrelRate: a.n_in_play >= MIN_RENDER_N ? wilsonCI(a.n_barrel, a.n_in_play) : null,
    runValue: a.n >= MIN_RENDER_N ? meanCI(a.n, a.sum_delta_run_exp, a.sum_delta_run_exp_sq) : null,
    kLookingRate: a.n >= MIN_RENDER_N ? wilsonCI(a.n_strikeout_looking, a.n) : null,
    kSwingingRate: a.n >= MIN_RENDER_N ? wilsonCI(a.n_strikeout_swinging, a.n) : null,
    pullRate: a.n_in_play >= MIN_RENDER_N ? wilsonCI(a.n_pull, a.n_in_play) : null,
    centerRate: a.n_in_play >= MIN_RENDER_N ? wilsonCI(a.n_center, a.n_in_play) : null,
    oppoRate: a.n_in_play >= MIN_RENDER_N ? wilsonCI(a.n_oppo, a.n_in_play) : null,
    pullGroundBallRate: a.n_in_play >= MIN_RENDER_N ? wilsonCI(a.n_pull_ground_ball, a.n_in_play) : null,
    pullGroundBallRunValue: a.n_pull_ground_ball >= MIN_RENDER_N ? meanCI(a.n_pull_ground_ball, a.sum_pull_gb_run_exp, a.sum_pull_gb_run_exp_sq) : null,
    whiffHighRate: a.n_whiff >= MIN_RENDER_N ? wilsonCI(a.n_whiff_high, a.n_whiff) : null,
    whiffMiddleRate: a.n_whiff >= MIN_RENDER_N ? wilsonCI(a.n_whiff_middle, a.n_whiff) : null,
    whiffLowRate: a.n_whiff >= MIN_RENDER_N ? wilsonCI(a.n_whiff_low, a.n_whiff) : null,
  }
}

export type AnchorCurvePoint = { bucket: number, stat: AnchorStat }

// Full anchor-differential curve for one anchor type — mirrors evDiffCurve/actualDiffCurve
// in lib/effectiveVelocity.ts.
export function anchorDiffCurve(rows: AnchorPairRow[], anchorType: AnchorType): AnchorCurvePoint[] {
  const map = new Map<number, RawAgg>()
  for (const r of rows) {
    if (r.anchor_type !== anchorType) continue
    map.set(r.anchor_diff_bucket, addAgg(map.get(r.anchor_diff_bucket) || emptyAgg(), r))
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
    .map(([bucket, a]) => ({ bucket, stat: toStat(`${bucket >= 0 ? '+' : ''}${bucket} mph from anchor`, a) }))
}

// Collapses a curve to two cards: "near the anchor" (within ±6mph, matching the Attention
// Zone width used by the previous-pitch model) vs. "far from the anchor" — the same shape as
// evAttentionZoneSplit, so the two models can be read side by side.
const ANCHOR_ZONE_MPH = 6
export function anchorZoneSplit(rows: AnchorPairRow[], anchorType: AnchorType): { within: AnchorStat, outside: AnchorStat } {
  let within = emptyAgg(), outside = emptyAgg()
  for (const r of rows) {
    if (r.anchor_type !== anchorType) continue
    if (Math.abs(r.anchor_diff_bucket) <= ANCHOR_ZONE_MPH) within = addAgg(within, r)
    else outside = addAgg(outside, r)
  }
  return {
    within: toStat(`Within ±${ANCHOR_ZONE_MPH} mph of anchor`, within),
    outside: toStat(`Outside ±${ANCHOR_ZONE_MPH} mph of anchor`, outside),
  }
}

export { ANCHOR_ZONE_MPH }
