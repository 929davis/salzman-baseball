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

// Supabase/PostgREST caps a single select() at a project-level max-rows setting (1000 by
// default) regardless of an explicit .range() — bs_joint (~7,055 rows) and bs_zone_sample
// (~2,671 rows) both exceed that, so a plain select('*') silently truncates. Page through
// in batches until a page comes back short of the page size.
export async function fetchAllRows(supabase: any, table: string): Promise<any[]> {
  const PAGE = 1000
  let all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

// ---------------------------------------------------------------------------
// Sequential simulator resolver — spec §3/§4.
// ---------------------------------------------------------------------------

export const OUTCOME_KEYS = ['ball','called_strike','swinging_strike','foul','walk','strikeout','out_in_play','single','double','triple','home_run','hbp'] as const
export type OutcomeKey = typeof OUTCOME_KEYS[number]

export const OUTCOME_LABELS: Record<OutcomeKey,string> = {
  ball:'Ball', called_strike:'Called Strike', swinging_strike:'Swinging Strike', foul:'Foul',
  walk:'Walk', strikeout:'Strikeout', out_in_play:'Out In Play',
  single:'Single', double:'Double', triple:'Triple', home_run:'Home Run', hbp:'Hit By Pitch',
}

export const PITCH_TYPE_GROUPS = ['Four-Seam','Sinker','Cutter','Slider','Sweeper','Curveball','Changeup','Other'] as const

export const BASE_STATES = ['empty','1st','2nd','3rd','1st_2nd','1st_3rd','2nd_3rd','loaded'] as const
export type BaseState = typeof BASE_STATES[number]

export const BASE_STATE_LABELS: Record<BaseState,string> = {
  empty:'Bases Empty', '1st':'Runner on 1st', '2nd':'Runner on 2nd', '3rd':'Runner on 3rd',
  '1st_2nd':'1st & 2nd', '1st_3rd':'1st & 3rd', '2nd_3rd':'2nd & 3rd', loaded:'Bases Loaded',
}

export function baseStateFromFlags(on1b:boolean, on2b:boolean, on3b:boolean): BaseState {
  if (on1b && on2b && on3b) return 'loaded'
  if (on1b && on2b) return '1st_2nd'
  if (on1b && on3b) return '1st_3rd'
  if (on2b && on3b) return '2nd_3rd'
  if (on1b) return '1st'
  if (on2b) return '2nd'
  if (on3b) return '3rd'
  return 'empty'
}

export type SituationDims = {
  pThrows: 'R'|'L', bats: 'R'|'L', pitchTypeGroup: string,
  countBucket: string, outs: number, baseState: BaseState,
}

// Keys used to look up rows in each aggregate table's Map, built once when the tables are
// fetched (see BaseScenarioTool.tsx). Order/format must match how the maps are built.
export const jointKey = (d: Pick<SituationDims,'pThrows'|'bats'|'pitchTypeGroup'|'countBucket'|'outs'|'baseState'>) =>
  `${d.pThrows}|${d.bats}|${d.pitchTypeGroup}|${d.countBucket}|${d.outs}|${d.baseState}`
export const pitchMarginalKey = (d: Pick<SituationDims,'pThrows'|'bats'|'pitchTypeGroup'|'countBucket'>) =>
  `${d.pThrows}|${d.bats}|${d.pitchTypeGroup}|${d.countBucket}`
export const reMarginalKey = (d: { outs:number, baseState:BaseState, countBucket:string }) =>
  `${d.outs}|${d.baseState}|${d.countBucket}`
export const zoneSampleKey = (d: Pick<SituationDims,'pThrows'|'bats'|'pitchTypeGroup'|'countBucket'> & { outcome: string }) =>
  `${d.pThrows}|${d.bats}|${d.pitchTypeGroup}|${d.countBucket}|${d.outcome}`

export type ResolvedOutcomes = {
  source: 'exact' | 'estimated' | 'no_data'
  n: number
  outcomes: Partial<Record<OutcomeKey, { n: number, ci: WilsonResult | null }>>
  avgRunValue: CIResult | null
}

// The core hybrid-backoff resolver (spec §3): use the joint cell when it has enough
// pitches to trust on its own; otherwise fall back to the matchup+pitch-type+count
// marginal for outcome probabilities. Run-value CI always comes from whichever row
// (joint or marginal) is actually being used, so it's internally consistent with the
// outcome breakdown shown alongside it.
export function resolveOutcomes(jointRow: any | undefined, pitchMarginalRow: any | undefined): ResolvedOutcomes {
  const useExact = !!jointRow && jointRow.n >= EXACT_CELL_THRESHOLD
  const row = useExact ? jointRow : pitchMarginalRow
  if (!row || !row.n) return { source: 'no_data', n: 0, outcomes: {}, avgRunValue: null }

  const outcomes: ResolvedOutcomes['outcomes'] = {}
  for (const key of OUTCOME_KEYS) {
    const k = row[`n_${key}`] ?? 0
    outcomes[key] = { n: k, ci: wilsonCI(k, row.n) }
  }
  const avgRunValue = meanCI(row.n, row.sum_delta_run_exp, row.sum_delta_run_exp_sq)
  return { source: useExact ? 'exact' : 'estimated', n: row.n, outcomes, avgRunValue }
}

// ---------------------------------------------------------------------------
// Batted-ball model — spec §7 ("Put In Play" branch).
// ---------------------------------------------------------------------------

export const LAUNCH_ANGLE_CATEGORIES = ['ground_ball','line_drive','fly_ball','popup'] as const
export const LAUNCH_ANGLE_LABELS: Record<string,string> = {
  ground_ball:'Ground Ball', line_drive:'Line Drive', fly_ball:'Fly Ball', popup:'Popup',
}

export const DIRECTIONS = ['pull','center','opposite'] as const
export const DIRECTION_LABELS: Record<string,string> = { pull:'Pull', center:'Center', opposite:'Opposite Field' }

export const BATTED_OUTCOME_KEYS = ['out','single','double','triple','home_run'] as const
export const BATTED_OUTCOME_LABELS: Record<string,string> = {
  out:'Out', single:'Single', double:'Double', triple:'Triple', home_run:'Home Run',
}

export type BaseGroup4 = 'empty' | '1st' | 'risp' | 'loaded'

// Clean 4-way partition of all 8 exact base states for the batted-ball RE backoff ladder
// (spec §3) — defined by "furthest occupied base," so every exact state maps to exactly
// one group (no ambiguity/overlap). "risp" here means any state with a runner on 2nd or
// 3rd that isn't bases-loaded (2nd, 3rd, 1st_2nd, 1st_3rd, 2nd_3rd) — broader than the
// broadcast-stat definition of RISP (which ignores whether 1st is also occupied), but this
// is the only way to keep all 4 groups mutually exclusive while preserving loaded as its
// own bucket (it has the biggest defensive-alignment effect — infield forced at every base).
export function baseGroup4(b: BaseState): BaseGroup4 {
  if (b === 'empty') return 'empty'
  if (b === '1st') return '1st'
  if (b === 'loaded') return 'loaded'
  return 'risp'
}

export type ResolvedBattedBall = {
  n: number
  outcomes: Partial<Record<string, { n: number, ci: WilsonResult | null }>>
  avgRunValue: CIResult | null
  reSource: 'exact' | 'grouped' | 'outs_only' | 'no_data'
}

// bs_batted_ball_outcome gives the out/1B/2B/3B/HR distribution directly (single granularity —
// EV bucket x launch angle x direction only, no base/out backoff, since contact-quality-to-
// outcome is a physics question that doesn't depend on the game situation). bs_batted_ball_re
// gives the run-value swing, which DOES depend on base/out state (a single is worth very
// different runs with the bases loaded vs. empty) — so that one backs off through the ladder:
// exact 8-state -> 4 grouped states -> outs-only, summing already-loaded raw rows at each step
// since counts are additive.
export function resolveBattedBall(
  outcomeRows: any[], reRows: any[],
  evBucket: number, launchAngleCategory: string, direction: string, outs: number, baseState: BaseState,
): ResolvedBattedBall {
  const outcomeRow = outcomeRows.find(r => r.ev_bucket === evBucket && r.launch_angle_category === launchAngleCategory && r.direction === direction)
  const n = outcomeRow?.n ?? 0
  const outcomes: ResolvedBattedBall['outcomes'] = {}
  for (const key of BATTED_OUTCOME_KEYS) {
    const k = outcomeRow?.[`n_${key}`] ?? 0
    outcomes[key] = { n: k, ci: n > 0 ? wilsonCI(k, n) : null }
  }

  const matchBB = (r:any) => r.ev_bucket===evBucket && r.launch_angle_category===launchAngleCategory && r.direction===direction && r.outs_when_up===outs
  const toBucket = (rows:any[]) => addBuckets(...rows.map(r => ({ n:r.n, sum:r.sum_delta_run_exp, sumSq:r.sum_delta_run_exp_sq })))

  let bucket = toBucket(reRows.filter(r => matchBB(r) && r.base_state === baseState))
  let reSource: ResolvedBattedBall['reSource'] = 'exact'
  if (bucket.n < EXACT_CELL_THRESHOLD) {
    const group = baseGroup4(baseState)
    const grouped = toBucket(reRows.filter(r => matchBB(r) && baseGroup4(r.base_state) === group))
    if (grouped.n >= EXACT_CELL_THRESHOLD) { bucket = grouped; reSource = 'grouped' }
    else {
      const outsOnly = toBucket(reRows.filter(matchBB))
      bucket = outsOnly
      reSource = outsOnly.n > 0 ? 'outs_only' : 'no_data'
    }
  }
  const avgRunValue = bucket.n > 1 ? meanCI(bucket.n, bucket.sum, bucket.sumSq) : null

  return { n, outcomes, avgRunValue, reSource }
}

export type UsageShare = { pitchTypeGroup: string, n: number, pct: number }

// Pitch-type usage % at the current matchup+count — the selection-bias guard (spec §4).
// Deliberately drops outs/base state (uses pitch marginal, not joint) since pitch-selection
// tendency is a matchup+count thing, not a situational one, and this keeps the sample large
// and stable rather than fragmenting it further.
export function computeUsageShares(pitchMarginalRows: any[], pThrows: string, bats: string, countBucket: string): UsageShare[] {
  const rows = pitchMarginalRows.filter(r => r.p_throws === pThrows && r.bats === bats && r.count_bucket === countBucket)
  const total = rows.reduce((s, r) => s + r.n, 0)
  return rows
    .map(r => ({ pitchTypeGroup: r.pitch_type_group, n: r.n, pct: total > 0 ? (r.n / total) * 100 : 0 }))
    .sort((a, b) => b.n - a.n)
}

// Picks a real zone (Statcast's own 1-9/11-14 numbering) for a given outcome, weighted by
// how often real pitches in this matchup+count actually landed there — not a fabricated
// location. Returns null if no sample exists for this exact combo (no backoff — see
// aggregate script comment on bs_zone_sample, this is a visual aid, not a statistical claim).
export function sampleZone(zoneSampleRow: any | undefined): number | null {
  if (!zoneSampleRow || !zoneSampleRow.n) return null
  const zones = [1,2,3,4,5,6,7,8,9,11,12,13,14]
  let roll = Math.random() * zoneSampleRow.n
  for (const z of zones) {
    roll -= zoneSampleRow[`zone_${z}`] ?? 0
    if (roll <= 0) return z
  }
  return zones[zones.length - 1]
}

// ---------------------------------------------------------------------------
// Pitch Sequence tool — most common (pitch type, location) 2-pitch sequences leading to a
// target outcome. See aggregate-base-scenario.mjs's computeSequences for how bs_sequence
// is built (last 2 pitches of each plate appearance).
// ---------------------------------------------------------------------------

export const TARGET_OUTCOMES = ['strikeout_looking','strikeout_swinging','weak_contact','barrel'] as const
export type TargetOutcome = typeof TARGET_OUTCOMES[number]
export const TARGET_OUTCOME_LABELS: Record<TargetOutcome,string> = {
  strikeout_looking: 'Strikeout Looking', strikeout_swinging: 'Strikeout Swinging',
  weak_contact: 'Weak Contact', barrel: 'Barrel',
}

export const LOCATION_BUCKETS = ['heart','edge','chase'] as const
export const LOCATION_BUCKET_LABELS: Record<string,string> = {
  heart: 'Heart (down the middle)', edge: 'Edge (in-zone corner)', chase: 'Chase (off the plate)',
}

// "If it happened once or twice, don't worry about it" — floor on the raw count of the
// target outcome itself for the frequency ranking, and on total sequence occurrences for
// the rate ranking (a rate computed from n=3 isn't a rate, it's noise).
export const SEQUENCE_MIN_N = 20

export type SequenceResult = {
  pt1: string, loc1: string, pt2: string, loc2: string,
  nTarget: number, nTotal: number, rate: WilsonResult | null,
}

// Definition B (mode) — of every plate appearance ending in this target outcome, which
// 2-pitch sequences show up most often. Simple frequency count. Dominated by whatever
// pitch is thrown most in general (e.g. four-seam) — that's expected, not a bug; pair with
// getTopSequencesByRate to separate "common sequence" from "uniquely dangerous sequence."
export function getTopSequencesByFrequency(rows: any[], target: TargetOutcome, pThrows: string, bats: string, limit = 10): SequenceResult[] {
  return rows
    .filter(r => r.p_throws === pThrows && r.bats === bats && r[`n_${target}`] >= SEQUENCE_MIN_N)
    .map(r => ({ pt1:r.pt1, loc1:r.loc1, pt2:r.pt2, loc2:r.loc2, nTarget:r[`n_${target}`], nTotal:r.n_total, rate: wilsonCI(r[`n_${target}`], r.n_total) }))
    .sort((a, b) => b.nTarget - a.nTarget)
    .slice(0, limit)
}

// Definition A (rate) — of sequences thrown often enough to trust a rate, which ones
// resulted in the target outcome most often. Requires n_total (not just n_target) above
// the floor, since this is a rate over ALL outcomes of that sequence, not just the target.
export function getTopSequencesByRate(rows: any[], target: TargetOutcome, pThrows: string, bats: string, limit = 10): SequenceResult[] {
  return rows
    .filter(r => r.p_throws === pThrows && r.bats === bats && r.n_total >= SEQUENCE_MIN_N)
    .map(r => ({ pt1:r.pt1, loc1:r.loc1, pt2:r.pt2, loc2:r.loc2, nTarget:r[`n_${target}`], nTotal:r.n_total, rate: wilsonCI(r[`n_${target}`], r.n_total) }))
    .sort((a, b) => (b.rate?.p ?? 0) - (a.rate?.p ?? 0))
    .slice(0, limit)
}
