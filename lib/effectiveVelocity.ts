// Perry Husband's "Effective Velocity" (EV) theory, Phase 1: the core location-adjusted-speed
// formula. This is the first of a 4-phase build (see conversation) that TESTS the theory
// against our own 2026 first-half data rather than assuming its published numbers are
// correct — an independent large-sample re-analysis (Driveline Baseball, 2.8M+ MLB pitches,
// 2015-2018) found EV's specific predictive claims (the +-6 EV mph "danger zone", season-level
// correlations) don't hold up under rigorous statistical testing. We implement Husband's
// classic formula faithfully here; Phase 3 is where OUR data assigns the real weights.
//
// Sources: https://fantasy.fangraphs.com/the-interplay-of-velocity-and-effective-velocity/
// (2.75 mph/6in coefficient, zero-line-as-diagonal description),
// https://pitcherlist.com/going-deep-a-example-in-the-practice-of-effective-velocity/
// (worked example), https://www.drivelinebaseball.com/2019/05/calling-right-pitch-investigating-effective-velocity-mlb-level/
// (independent statistical re-test, cited above and in Phase 3).

// Husband's classic published coefficient: 2.75 mph of perceived-speed change per 6 inches
// of distance off the Zero Line. Expressed per inch for the formula below.
export const EV_MPH_PER_INCH = 2.75 / 6

// Hitters' "Attention Zone" — Husband's claim that batters perform best within roughly a
// 5-6 mph EV band once calibrated to a pitcher's recent velocities. Used in later phases to
// bucket sequences as in/out of a hitter's comfort band; not used by the per-pitch formula
// itself.
export const ATTENTION_ZONE_MPH = 6

export type Bats = 'R' | 'L'

export type PitchGeometry = {
  plateX: number   // Statcast plate_x, feet, catcher's-perspective (positive = 1st-base side)
  plateZ: number    // Statcast plate_z, feet
  szTop: number     // top of this batter's own strike zone, feet
  szBot: number      // bottom of this batter's own strike zone, feet
  bats: Bats
}

// Insideness in inches, positive = toward the batter (inside), negative = away — sign
// flipped per batter side since plate_x is catcher-perspective, not batter-relative.
// Verified empirically (not assumed from docs): for real 2026 batted balls, RHH pull
// contact averages plate_x ~ -0.035 (inside-for-RHH is negative x) while RHH opposite-field
// contact averages plate_x ~ +0.152 (away-for-RHH is positive x) — and this flips sign for
// LHH (pull ~ +0.024, opposite ~ -0.157), confirming plate_x is fixed to the field/catcher,
// not the batter, exactly as Statcast's own convention is documented to work.
export function insidenessInches(g: PitchGeometry): number {
  const signed = g.bats === 'R' ? -g.plateX : g.plateX
  return signed * 12
}

// Height in inches relative to the vertical MIDPOINT of this batter's own strike zone (not
// an absolute plate_z) — normalizes for batter height/stance differences, which sz_top/
// sz_bot already capture per-pitch.
export function heightInches(g: PitchGeometry): number {
  const midZ = (g.szTop + g.szBot) / 2
  return (g.plateZ - midZ) * 12
}

// The Zero Line runs diagonally from the low-and-in corner to the high-and-away corner —
// pitches on that line have EV == actual velocity, because "up" and "in" push perceived
// speed in the SAME direction (both speed it up) while "away" and "down" both slow it down;
// up+away and down+in cancel out near zero, while up+in and down+away reinforce, becoming
// the fastest/slowest corners. That makes the EV-changing axis a simple sum of the two
// components in the same inch units — NOT their true Euclidean perpendicular distance from
// the diagonal (that would divide by sqrt(2)). Husband's own published material doesn't give
// an unambiguous combined-axis formula (only single-axis examples), so this additive form is
// our documented simplification, chosen because it reproduces his own cited ~8-10 mph
// corner-to-corner spread almost exactly against real 2026 zone dimensions (avg zone height
// ~19in, plate half-width ~8.5in -> ~18in max axis value -> ~8.25 mph swing).
export function evAxisInches(g: PitchGeometry): number {
  return insidenessInches(g) + heightInches(g)
}

// Effective Velocity: release speed adjusted for this location's position on the EV axis.
export function effectiveVelocity(releaseSpeed: number, g: PitchGeometry): number {
  return releaseSpeed + evAxisInches(g) * EV_MPH_PER_INCH
}

export function evAdjustmentMph(g: PitchGeometry): number {
  return evAxisInches(g) * EV_MPH_PER_INCH
}

// --- Sequencing (used starting Phase 2) ---------------------------------------------------

export type PitchForEV = PitchGeometry & { releaseSpeed: number }

export type SequencePairStats = {
  actualDiffMph: number      // curr.releaseSpeed - prev.releaseSpeed (signed)
  evDiffMph: number          // curr EV - prev EV (signed)
  withinAttentionZone: boolean // |evDiffMph| <= ATTENTION_ZONE_MPH — Husband's "danger zone" claim
  sameDirection: boolean     // true if actual and EV diffs moved the same way (both faster-perceived or both slower-perceived) — a same-direction step is theorized to be easier to track than a reversal of similar size
}

export function sequencePairStats(prev: PitchForEV, curr: PitchForEV): SequencePairStats {
  const prevEv = effectiveVelocity(prev.releaseSpeed, prev)
  const currEv = effectiveVelocity(curr.releaseSpeed, curr)
  const actualDiffMph = curr.releaseSpeed - prev.releaseSpeed
  const evDiffMph = currEv - prevEv
  return {
    actualDiffMph,
    evDiffMph,
    withinAttentionZone: Math.abs(evDiffMph) <= ATTENTION_ZONE_MPH,
    sameDirection: Math.sign(actualDiffMph) !== 0 && Math.sign(actualDiffMph) === Math.sign(evDiffMph),
  }
}

// --- Phase 3: test the theory against real bs_ev_pairs data ------------------------------
//
// This is the section that assigns OUR weights instead of trusting Husband's published
// numbers — same intent as Driveline's independent re-test (cited at the top of this file),
// run fresh against our own 2026 first-half data. Every stat below carries a real confidence
// interval and a hard MIN_RENDER_N floor (shared with the rest of the app), so a thin bucket
// shows as "not enough data" rather than a misleadingly precise number.

import { meanCI, wilsonCI, MIN_RENDER_N, type CIResult, type WilsonResult } from './baseScenario'

export type EvPairRow = {
  ev_diff_bucket: number
  actual_diff_bucket: number
  within_attention_zone: boolean
  same_direction: boolean
  n: number
  n_whiff: number
  n_in_play: number
  n_hard_hit: number
  n_barrel: number
  sum_delta_run_exp: number
  sum_delta_run_exp_sq: number
}

type RawAgg = { n: number, n_whiff: number, n_in_play: number, n_hard_hit: number, n_barrel: number, sum_delta_run_exp: number, sum_delta_run_exp_sq: number }
const emptyAgg = (): RawAgg => ({ n: 0, n_whiff: 0, n_in_play: 0, n_hard_hit: 0, n_barrel: 0, sum_delta_run_exp: 0, sum_delta_run_exp_sq: 0 })
const addAgg = (a: RawAgg, r: EvPairRow): RawAgg => ({
  n: a.n + r.n, n_whiff: a.n_whiff + r.n_whiff, n_in_play: a.n_in_play + r.n_in_play,
  n_hard_hit: a.n_hard_hit + r.n_hard_hit, n_barrel: a.n_barrel + r.n_barrel,
  sum_delta_run_exp: a.sum_delta_run_exp + r.sum_delta_run_exp, sum_delta_run_exp_sq: a.sum_delta_run_exp_sq + r.sum_delta_run_exp_sq,
})

export type EvPrincipleStat = {
  label: string
  n: number
  // Note on sign: delta_run_exp is from the BATTING team's perspective (positive = good for
  // the batter) — so a LOWER runValue is the better outcome for the pitcher, same convention
  // used throughout the rest of this tool (bs_re_marginal, bs_count_leverage, etc).
  whiffRate: WilsonResult | null
  hardHitRate: WilsonResult | null  // among balls in play only
  barrelRate: WilsonResult | null   // among balls in play only
  runValue: CIResult | null
}

function toStat(label: string, a: RawAgg): EvPrincipleStat {
  return {
    label, n: a.n,
    whiffRate: a.n >= MIN_RENDER_N ? wilsonCI(a.n_whiff, a.n) : null,
    hardHitRate: a.n_in_play >= MIN_RENDER_N ? wilsonCI(a.n_hard_hit, a.n_in_play) : null,
    barrelRate: a.n_in_play >= MIN_RENDER_N ? wilsonCI(a.n_barrel, a.n_in_play) : null,
    runValue: a.n >= MIN_RENDER_N ? meanCI(a.n, a.sum_delta_run_exp, a.sum_delta_run_exp_sq) : null,
  }
}

// Principle #3 (Sequencing threshold): Husband's headline claim — pitches within +-6 EV mph
// of the previous pitch are where hitters do the most damage.
export function evAttentionZoneSplit(rows: EvPairRow[]): { within: EvPrincipleStat, outside: EvPrincipleStat } {
  let within = emptyAgg(), outside = emptyAgg()
  for (const r of rows) { if (r.within_attention_zone) within = addAgg(within, r); else outside = addAgg(outside, r) }
  return {
    within: toStat(`Within ±${ATTENTION_ZONE_MPH} EV mph`, within),
    outside: toStat(`Outside ±${ATTENTION_ZONE_MPH} EV mph`, outside),
  }
}

// Principle #4 (Direction of change): does a perceived-speed reversal (fast-feeling pitch
// followed by a slow-feeling one, or vice versa) suppress contact more than a same-direction
// step of similar magnitude?
export function evDirectionSplit(rows: EvPairRow[]): { same: EvPrincipleStat, reversal: EvPrincipleStat } {
  let same = emptyAgg(), reversal = emptyAgg()
  for (const r of rows) { if (r.same_direction) same = addAgg(same, r); else reversal = addAgg(reversal, r) }
  return { same: toStat('Same direction', same), reversal: toStat('Direction reversal', reversal) }
}

export type EvCurvePoint = { bucket: number, stat: EvPrincipleStat }

// Full EV-differential curve (summed across the other 3 grouping dims per bucket) — lets the
// UI chart the whole relationship rather than just one in/out split.
export function evDiffCurve(rows: EvPairRow[]): EvCurvePoint[] {
  const map = new Map<number, RawAgg>()
  for (const r of rows) map.set(r.ev_diff_bucket, addAgg(map.get(r.ev_diff_bucket) || emptyAgg(), r))
  return [...map.entries()].sort((a, b) => a[0] - b[0])
    .map(([bucket, a]) => ({ bucket, stat: toStat(`${bucket >= 0 ? '+' : ''}${bucket} EV mph`, a) }))
}

// Same, but for RAW velocity differential — the direct comparison independent research
// flagged as the actual driver: swing-and-miss rate tracking raw velo diff rather than EV
// diff once the two are looked at separately.
export function actualDiffCurve(rows: EvPairRow[]): EvCurvePoint[] {
  const map = new Map<number, RawAgg>()
  for (const r of rows) map.set(r.actual_diff_bucket, addAgg(map.get(r.actual_diff_bucket) || emptyAgg(), r))
  return [...map.entries()].sort((a, b) => a[0] - b[0])
    .map(([bucket, a]) => ({ bucket, stat: toStat(`${bucket >= 0 ? '+' : ''}${bucket} mph`, a) }))
}

export type WeightedFit = { slope: number, intercept: number, r: number }

// Sample-size-weighted linear regression — this IS "the weight": how much a rate/mean
// actually moves per mph of the axis in question, in OUR data, with r as the effect-size
// check (near 0 means the claimed relationship isn't really there, regardless of slope sign).
export function weightedLinearFit(points: { x: number, y: number, w: number }[]): WeightedFit | null {
  const valid = points.filter(p => isFinite(p.y) && p.w > 0)
  if (valid.length < 2) return null
  const W = valid.reduce((s, p) => s + p.w, 0)
  const xBar = valid.reduce((s, p) => s + p.w * p.x, 0) / W
  const yBar = valid.reduce((s, p) => s + p.w * p.y, 0) / W
  let sxy = 0, sxx = 0, syy = 0
  for (const p of valid) {
    const dx = p.x - xBar, dy = p.y - yBar
    sxy += p.w * dx * dy; sxx += p.w * dx * dx; syy += p.w * dy * dy
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  return { slope, intercept: yBar - slope * xBar, r: syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy) }
}

// Fits one of a curve's stat fields (hard-hit rate, whiff rate, run value, ...) against its
// bucket value, weighted by each bucket's real sample size.
export function fitCurve(curve: EvCurvePoint[], pick: (s: EvPrincipleStat) => number | null): WeightedFit | null {
  const points = curve
    .map(c => { const y = pick(c.stat); return y == null ? null : { x: c.bucket, y, w: c.stat.n } })
    .filter((p): p is { x: number, y: number, w: number } => p !== null)
  return weightedLinearFit(points)
}
