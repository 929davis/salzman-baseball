// Shared Baseball Savant deep-link builder. Every param here was verified against the live
// Savant CSV endpoint (not assumed from docs/blog posts) — see conversation history for the
// verification method. Used by both PitchingIQ.tsx (zone/metric focused) and
// BaseScenarioTool.tsx (situation focused) so the verified logic lives in one place.

// hfRO ("runners on") verified behavior: each code means "has a runner on that specific
// base" — INCLUSIVE, not exact. hfRO=1| matches 1st-only AND 1st+2nd AND 1st+3rd AND loaded —
// there's no way to say "and nobody else." Pipe-combining multiple codes is AND, not OR
// (confirmed: hfRO=1|3| only returns rows with BOTH 1st and 3rd occupied). Only two states
// are exactly isolatable: empty (hfRO=0|) and loaded (hfRO=1|2|3|, confirmed to intersect
// down to exactly bases-loaded). All partial states (1st, 2nd, 3rd, 1st+2nd, etc.) are
// inclusive supersets of what's shown in the app — label them as "runner(s) on X" in the UI,
// not as an exact match, per the tool's own transparency requirement.
const BASE_STATE_TO_HFRO: Record<string, string | null> = {
  empty: '0',
  '1st': '1',
  '2nd': '2',
  '3rd': '3',
  '1st_2nd': '1|2',
  '1st_3rd': '1|3',
  '2nd_3rd': '2|3',
  loaded: '1|2|3',
}

// Base-state codes whose hfRO filter is an exact match rather than an inclusive superset.
export const EXACT_BASE_STATES = new Set(['empty', 'loaded'])

// Representative raw Statcast pitch_type code per pitch-type-group bucket (see
// aggregate-base-scenario.mjs's PITCH_TYPE_GROUP_SQL) — a group can include rarer sibling
// codes (e.g. Slider also covers ST/SV) the single-code Savant link won't reflect. Documented
// simplification, not verified per-code the way hand/count/outs/base state are.
export const PITCH_TYPE_GROUP_TO_CODE: Record<string, string> = {
  'Four-Seam': 'FF', 'Sinker': 'SI', 'Cutter': 'FC',
  'Slider': 'SL', 'Curveball': 'CU', 'Changeup': 'CH',
}

export type SavantLinkParams = {
  dateGt: string
  dateLt: string
  pitcherThrows?: 'R' | 'L'
  batterStands?: 'R' | 'L'
  countBucket?: string       // 'B-S', e.g. '1-2'
  outs?: number
  baseState?: string         // key into BASE_STATE_TO_HFRO
  pitchType?: string         // raw Statcast code (e.g. 'FF') — map pitch_type_group via PITCH_TYPE_GROUP_TO_CODE before passing
  zone?: number
  metric?: 'whiff' | 'hard_hit'
}

export function buildSavantLink(p: SavantLinkParams): string {
  const params = new URLSearchParams({
    hfGT: 'R|',
    hfSea: '2026|',
    player_type: 'pitcher',
    group_by: 'name-date',
    min_pitches: '0',
    min_results: '0',
    min_pas: '0',
    sort_col: 'pitches',
    sort_order: 'desc',
    game_date_gt: p.dateGt,
    game_date_lt: p.dateLt,
  })
  if (p.zone != null) params.set('hfNewZones', `${p.zone}|`)
  if (p.pitcherThrows) params.set('pitcher_throws', p.pitcherThrows)
  if (p.batterStands) params.set('batter_stands', p.batterStands)
  if (p.countBucket) {
    const [balls, strikes] = p.countBucket.split('-')
    params.set('hfC', `${balls}${strikes}|`)
  }
  if (p.outs != null) params.set('hfOuts', `${p.outs}|`)
  if (p.baseState) {
    const hfRO = BASE_STATE_TO_HFRO[p.baseState]
    if (hfRO) params.set('hfRO', `${hfRO}|`)
  }
  if (p.pitchType) params.set('hfPT', `${p.pitchType}|`)
  // hfPR (pitch result) and hfFlag (Statcast flag) verified against Savant's live CSV export —
  // confirmed hfPR filters strictly by description, hfFlag's hardhit value strictly by launch_speed>=95 on balls in play.
  if (p.metric === 'whiff') params.set('hfPR', 'swinging\\.\\.strike|swinging\\.\\.strike\\.\\.blocked|')
  else if (p.metric === 'hard_hit') params.set('hfFlag', 'is\\.\\.hit\\.\\.into\\.\\.play\\.\\.hardhit|')
  return `https://baseballsavant.mlb.com/statcast_search?${params.toString()}#results`
}
