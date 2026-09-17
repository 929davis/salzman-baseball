// Shared between the throw_log entry/rolling-view UI (app/components/ThrowLogPanel.tsx) and
// the athlete constraint computation (lib/engine/athleteConstraints.ts) -- one weighting table
// and one ratio calculation, not two copies to keep in sync.

export const IMPLEMENT_WEIGHTS: Record<string, number> = {
  '5oz': 1.0,
  '4oz': 1.1,
  '6oz': 1.1,
  crosstrain: 0.8,
}

export const THROW_TYPES = ['drill', 'long_toss', 'flat_ground', 'bullpen', 'outing', 'pulldown', 'weighted'] as const
export const IMPLEMENTS = ['5oz', '4oz', '6oz', 'crosstrain'] as const
export const INTENT_LEVELS = ['I1', 'I2', 'I3', 'I4', 'I5'] as const

// Not one of THROW_TYPES / not pickable from the per-session type dropdown -- this is the
// marker for a "quick weekly total" entry (ThrowLogPanel's fast-entry mode), one row standing
// in for a whole week Davis isn't going to log session-by-session. See expandWeeklyAggregates
// below for how it's turned back into something the ratio math can use.
export const WEEKLY_AGGREGATE_TYPE = 'weekly_aggregate'

export type ThrowLogEntry = {
  id: string
  pitcher_id: string
  throw_date: string
  throw_type: string
  count: number
  implement: string
  intent_level: string | null
  notes: string | null
}

export function weightedThrowCount(entry: { count: number, implement: string }): number {
  const weight = IMPLEMENT_WEIGHTS[entry.implement] ?? 1.0
  return entry.count * weight
}

type RatioInputEntry = { throw_date: string, count: number, implement: string, throw_type?: string }

function mondayOfDateStr(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diffToMonday)
  return d
}

// Turns each weekly_aggregate entry into 7 synthetic per-day entries (Monday-Sunday of its
// week, per the fast-entry form's "week-of" date), count split evenly across them, same
// implement on all 7. Everything else passes through untouched. This is a deliberate
// approximation -- real throwing within a week is rarely perfectly even -- see the report on
// what that does and doesn't cost the acute/chronic ratio.
function expandWeeklyAggregates(entries: RatioInputEntry[]): { throw_date: string, count: number, implement: string }[] {
  const expanded: { throw_date: string, count: number, implement: string }[] = []
  for (const e of entries) {
    if (e.throw_type !== WEEKLY_AGGREGATE_TYPE) {
      expanded.push({ throw_date: e.throw_date, count: e.count, implement: e.implement })
      continue
    }
    const monday = mondayOfDateStr(e.throw_date)
    const perDay = e.count / 7
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      expanded.push({ throw_date: d.toISOString().split('T')[0], count: perDay, implement: e.implement })
    }
  }
  return expanded
}

export type ACWRBand = '<0.8' | '0.8-1.3' | '1.3-1.5' | '>1.5'

// Acute:chronic workload ratio bands. <0.8 under-training relative to recent baseline (real,
// but a different kind of flag than the other three -- often a detraining/reconditioning
// concern rather than an injury-risk one). 0.8-1.3 is the commonly-cited "sweet spot." 1.3-1.5
// caution. >1.5 the highest-risk band.
export function classifyACWR(ratio: number): ACWRBand {
  if (ratio < 0.8) return '<0.8'
  if (ratio <= 1.3) return '0.8-1.3'
  if (ratio <= 1.5) return '1.3-1.5'
  return '>1.5'
}

export const HISTORY_DAYS_REQUIRED = 28

export type ThrowLoadResult = {
  acute7d: number
  chronicWeeklyAvg28d: number
  ratio: number | null
  band: ACWRBand | null
  daysOfHistory: number
  hasEnoughHistory: boolean
}

// Computes the acute(7d)/chronic(28d weekly average)/ratio picture as of `asOfDate` (defaults
// to today). Returns hasEnoughHistory:false (and null ratio/band) when fewer than 28 days of
// throw_log history exist yet for this pitcher -- a ratio computed from less than that isn't
// meaningful, per the explicit instruction not to show one prematurely.
export function computeThrowLoadRatio(
  entries: RatioInputEntry[],
  asOfDate: Date = new Date(),
): ThrowLoadResult {
  const asOf = new Date(asOfDate)
  asOf.setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000

  let acute7d = 0
  let chronic28d = 0
  let earliestDaysAgo = -1
  for (const e of expandWeeklyAggregates(entries)) {
    const d = new Date(e.throw_date + 'T00:00:00')
    const diff = Math.floor((asOf.getTime() - d.getTime()) / dayMs)
    if (diff < 0) continue // future-dated, ignore
    const w = weightedThrowCount(e)
    if (diff < 7) acute7d += w
    if (diff < 28) chronic28d += w
    if (diff > earliestDaysAgo) earliestDaysAgo = diff
  }
  const daysOfHistory = Math.max(earliestDaysAgo + 1, 0)
  const hasEnoughHistory = daysOfHistory >= HISTORY_DAYS_REQUIRED
  const chronicWeeklyAvg28d = chronic28d / 4
  const ratio = hasEnoughHistory && chronicWeeklyAvg28d > 0 ? acute7d / chronicWeeklyAvg28d : null

  return {
    acute7d: Math.round(acute7d * 10) / 10,
    chronicWeeklyAvg28d: Math.round(chronicWeeklyAvg28d * 10) / 10,
    ratio: ratio != null ? Math.round(ratio * 100) / 100 : null,
    band: ratio != null ? classifyACWR(ratio) : null,
    daysOfHistory: Math.min(daysOfHistory, HISTORY_DAYS_REQUIRED),
    hasEnoughHistory,
  }
}

// Groups entries into week buckets (Monday-start, matching DAYS elsewhere in this app) over
// the trailing 28 days, each bucket's total weighted throw count -- what the rolling 28-day
// view (Task 3) actually renders.
export type WeekBucket = { weekStart: string, weightedTotal: number }

export function computeWeeklyBuckets(
  entries: RatioInputEntry[],
  asOfDate: Date = new Date(),
): WeekBucket[] {
  const asOf = new Date(asOfDate)
  asOf.setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  const cutoff = new Date(asOf.getTime() - 27 * dayMs)

  const mondayOf = (d: Date) => {
    const copy = new Date(d)
    const dow = copy.getDay() // 0=Sun..6=Sat
    const diffToMonday = dow === 0 ? -6 : 1 - dow
    copy.setDate(copy.getDate() + diffToMonday)
    return copy.toISOString().split('T')[0]
  }

  const buckets = new Map<string, number>()
  for (const e of expandWeeklyAggregates(entries)) {
    const d = new Date(e.throw_date + 'T00:00:00')
    if (d < cutoff || d > asOf) continue
    const key = mondayOf(d)
    buckets.set(key, (buckets.get(key) || 0) + weightedThrowCount(e))
  }
  return Array.from(buckets.entries())
    .map(([weekStart, weightedTotal]) => ({ weekStart, weightedTotal: Math.round(weightedTotal * 10) / 10 }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}
