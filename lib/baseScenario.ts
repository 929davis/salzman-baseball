// Base Scenario Tool — shared stats + resolver helpers.
// See spec §3 (hybrid backoff), §9 (signal vs. noise handling).

// Minimum sample size before a joint (exact) cell is trusted over its marginal fallback.
// Tunable per spec §3/§12 — start conservative, adjust once real usage data exists.
export const EXACT_CELL_THRESHOLD = 100

// Hard floor below which a rate/average isn't rendered at all — "insufficient sample."
export const MIN_RENDER_N = 20

export type CIResult = { mean: number, lower: number, upper: number, n: number }

// 95% CI on a mean via standard error (normal approximation) — appropriate here because
// every place this is used (count leverage, RE marginals) aggregates thousands of pitches
// at minimum. NOT appropriate for small-n proportions — use wilsonCI for those instead.
export function meanCI(n: number, sum: number, sumSq: number): CIResult | null {
  if (n < 2) return null
  const mean = sum / n
  const variance = Math.max(0, (sumSq - n * mean * mean) / (n - 1))
  const se = Math.sqrt(variance / n)
  return { mean, lower: mean - 1.96 * se, upper: mean + 1.96 * se, n }
}

export type WilsonResult = { p: number, lower: number, upper: number, n: number }

// Wilson score interval — correct choice for small-n proportions (naive normal approximation
// breaks down badly here, e.g. produces impossible bounds outside [0,1] at low n).
export function wilsonCI(successes: number, n: number): WilsonResult | null {
  if (n <= 0) return null
  const z = 1.96
  const p = successes / n
  const denom = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denom
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
  return { p, lower: Math.max(0, center - margin), upper: Math.min(1, center + margin), n }
}

// Combines a raw {n, sum, sumSq} bucket in the shape every aggregate table stores its
// outcome columns as.
export type Bucket = { n: number, sum: number, sumSq: number }

export function addBuckets(...buckets: Bucket[]): Bucket {
  return buckets.reduce((acc, b) => ({ n: acc.n + b.n, sum: acc.sum + b.sum, sumSq: acc.sumSq + b.sumSq }), { n: 0, sum: 0, sumSq: 0 })
}

// Count Leverage Table's "ball" and "strike" values aren't single raw columns — at counts
// where a ball would be ball four, or a strike would be strike three, those pitches get
// classified as `walk`/`strikeout` instead of `ball`/`called_strike` (see aggregation
// script). Combining ball+walk and called_strike+swinging_strike+strikeout gives a value
// that's always populated regardless of count, since exactly one side of each pair is zero
// for any given count. Fouls are deliberately excluded from the "strike" side — a foul
// doesn't end the PA or advance the strike count at 2 strikes, so it isn't a clean binary
// comparison the way ball-vs-strike is.
export function countLeverageBallBucket(row: any): Bucket {
  return addBuckets(
    { n: row.n_ball, sum: row.sum_delta_run_exp_ball, sumSq: row.sum_delta_run_exp_ball_sq },
    { n: row.n_walk, sum: row.sum_delta_run_exp_walk, sumSq: row.sum_delta_run_exp_walk_sq },
  )
}

export function countLeverageStrikeBucket(row: any): Bucket {
  return addBuckets(
    { n: row.n_called_strike, sum: row.sum_delta_run_exp_called_strike, sumSq: row.sum_delta_run_exp_called_strike_sq },
    { n: row.n_swinging_strike, sum: row.sum_delta_run_exp_swinging_strike, sumSq: row.sum_delta_run_exp_swinging_strike_sq },
    { n: row.n_strikeout, sum: row.sum_delta_run_exp_strikeout, sumSq: row.sum_delta_run_exp_strikeout_sq },
  )
}

export const COUNT_ORDER = ['0-0','0-1','0-2','1-0','1-1','1-2','2-0','2-1','2-2','3-0','3-1','3-2']
