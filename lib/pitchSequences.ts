// Pitch Sequence tool — most common (pitch type, location) 2-pitch combos leading to a
// chosen result, with Perry Husband's Effective Velocity built into every row (mean EV diff,
// mean raw velocity diff, % within the attention zone, mean expected run value) so you can
// see at a glance whether a sequence's effect is actually an EV story or just a velocity one.
//
// Two scopes, two tables (see aggregate-base-scenario.mjs's computeSequencePA/
// computeSequenceAny for how each is built) — they answer different questions:
//   - bs_sequence_pa: last-2-pitches-of-the-at-bat only. Single/double/triple/home_run/walk/
//     hbp/strikeout can each only happen once per at-bat — a true final result.
//   - bs_sequence_any: EVERY consecutive pitch pair. A swinging strike can happen on any
//     pitch, whether or not it ends the at-bat — this is the only place that shows up.

import { meanCI, wilsonCI, type CIResult, type WilsonResult } from './baseScenario'

export const LOCATION_BUCKETS = ['heart', 'edge', 'chase'] as const
export const LOCATION_BUCKET_LABELS: Record<string, string> = {
  heart: 'Heart (down the middle)', edge: 'Edge (in-zone corner)', chase: 'Chase (off the plate)',
}

// "If it happened once or twice, don't worry about it" — floor on total sequence
// occurrences before a rate/rank is trusted.
export const SEQUENCE_MIN_N = 20

export const PA_TARGET_OUTCOMES = [
  'single', 'double', 'triple', 'home_run', 'walk', 'hbp',
  'strikeout_looking', 'strikeout_swinging', 'out_in_play', 'barrel', 'weak_contact',
] as const
export type PaTargetOutcome = typeof PA_TARGET_OUTCOMES[number]
export const PA_TARGET_OUTCOME_LABELS: Record<PaTargetOutcome, string> = {
  single: 'Single', double: 'Double', triple: 'Triple', home_run: 'Home Run',
  walk: 'Walk', hbp: 'Hit By Pitch',
  strikeout_looking: 'Strikeout Looking', strikeout_swinging: 'Strikeout Swinging',
  out_in_play: 'Out (In Play)', barrel: 'Barrel', weak_contact: 'Weak Contact',
}
// bs_sequence_pa's outcome-count column for each target — barrel/weak_contact are
// independent flags (not exclusive with the hit type), everything else maps 1:1.
const PA_TARGET_COLUMN: Record<PaTargetOutcome, string> = {
  single: 'n_single', double: 'n_double', triple: 'n_triple', home_run: 'n_home_run',
  walk: 'n_walk', hbp: 'n_hbp',
  strikeout_looking: 'n_strikeout_looking', strikeout_swinging: 'n_strikeout_swinging',
  out_in_play: 'n_out_in_play', barrel: 'n_barrel', weak_contact: 'n_weak_contact',
}

export const ANY_TARGET_OUTCOMES = [
  'ball', 'called_strike', 'swinging_strike', 'foul', 'in_play', 'hard_hit', 'barrel',
] as const
export type AnyTargetOutcome = typeof ANY_TARGET_OUTCOMES[number]
export const ANY_TARGET_OUTCOME_LABELS: Record<AnyTargetOutcome, string> = {
  ball: 'Ball', called_strike: 'Called Strike', swinging_strike: 'Swinging Strike',
  foul: 'Foul', in_play: 'Put In Play', hard_hit: 'Hard-Hit Ball', barrel: 'Barrel',
}
const ANY_TARGET_COLUMN: Record<AnyTargetOutcome, string> = {
  ball: 'n_ball', called_strike: 'n_called_strike', swinging_strike: 'n_swinging_strike',
  foul: 'n_foul', in_play: 'n_in_play', hard_hit: 'n_hard_hit', barrel: 'n_barrel',
}

// Shared shape both tables carry alongside their own outcome-count columns.
type SequenceRow = {
  p_throws: string, bats: string, pt1: string, loc1: string, pt2: string, loc2: string,
  n: number,
  n_within_attention_zone: number, n_same_direction: number,
  sum_ev_diff: number, sum_ev_diff_sq: number,
  sum_actual_diff: number, sum_actual_diff_sq: number,
  sum_delta_run_exp: number, sum_delta_run_exp_sq: number,
  [key: string]: any,
}

export type SequenceEvStats = {
  evDiff: CIResult | null           // mean perceived-speed change from the previous pitch
  actualDiff: CIResult | null       // mean raw radar-speed change from the previous pitch
  attentionZoneRate: WilsonResult | null  // % within Husband's +-6 EV mph "danger zone"
  sameDirectionRate: WilsonResult | null  // % where actual and EV speed moved the same way
  runValue: CIResult | null         // mean delta_run_exp (negative = good for the pitcher)
}

function sequenceEvStats(row: SequenceRow): SequenceEvStats {
  return {
    evDiff: meanCI(row.n, row.sum_ev_diff, row.sum_ev_diff_sq),
    actualDiff: meanCI(row.n, row.sum_actual_diff, row.sum_actual_diff_sq),
    attentionZoneRate: wilsonCI(row.n_within_attention_zone, row.n),
    sameDirectionRate: wilsonCI(row.n_same_direction, row.n),
    runValue: meanCI(row.n, row.sum_delta_run_exp, row.sum_delta_run_exp_sq),
  }
}

export type SequenceRankResult = {
  pt1: string, loc1: string, pt2: string, loc2: string,
  nTarget: number, nTotal: number, rate: WilsonResult | null,
  ev: SequenceEvStats,
}

function rankSequences(rows: SequenceRow[], targetColumn: string, pThrows: string, bats: string, mode: 'rate' | 'frequency', limit: number): SequenceRankResult[] {
  const results = rows
    .filter(r => r.p_throws === pThrows && r.bats === bats && r.n >= SEQUENCE_MIN_N)
    .map(r => ({
      pt1: r.pt1, loc1: r.loc1, pt2: r.pt2, loc2: r.loc2,
      nTarget: r[targetColumn] as number, nTotal: r.n,
      rate: wilsonCI(r[targetColumn] as number, r.n),
      ev: sequenceEvStats(r),
    }))
  if (mode === 'rate') return results.sort((a, b) => (b.rate?.p ?? 0) - (a.rate?.p ?? 0)).slice(0, limit)
  return results.sort((a, b) => b.nTarget - a.nTarget).slice(0, limit)
}

export function getTopPaSequences(rows: SequenceRow[], target: PaTargetOutcome, pThrows: string, bats: string, mode: 'rate' | 'frequency', limit = 10): SequenceRankResult[] {
  return rankSequences(rows, PA_TARGET_COLUMN[target], pThrows, bats, mode, limit)
}

export function getTopAnySequences(rows: SequenceRow[], target: AnyTargetOutcome, pThrows: string, bats: string, mode: 'rate' | 'frequency', limit = 10): SequenceRankResult[] {
  return rankSequences(rows, ANY_TARGET_COLUMN[target], pThrows, bats, mode, limit)
}
