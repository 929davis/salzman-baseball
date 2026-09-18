// Single home for "what Monday does this date belong to" -- this logic existed as two
// separate, independently-written copies inside lib/throwLog.ts before this file, plus a third
// need in app/coach/page.tsx/lib/engine/athleteConstraints.ts for dated program-week lookups.
// One function, everywhere, matching this app's Monday-start week convention (DAY_ORDER,
// Postgres's date_trunc('week', ...), programs.week_of's DB-level CHECK constraint).

// Accepts either a Date or a 'YYYY-MM-DD' string, returns the Monday of that week as
// 'YYYY-MM-DD', computed in local time (matching how throw_date/log_date/week_of are read
// elsewhere in this app -- see lib/throwLog.ts's history on UTC-vs-local date bugs).
export function mondayOf(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input + 'T00:00:00') : new Date(input)
  const dow = d.getDay() // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diffToMonday)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function currentWeekOf(): string {
  return mondayOf(new Date())
}

export function addWeeks(weekOf: string, n: number): string {
  const d = new Date(weekOf + 'T00:00:00')
  d.setDate(d.getDate() + n * 7)
  return mondayOf(d)
}

// Local-safe 'YYYY-MM-DD' n days after a given date string -- never routes through
// toISOString() (UTC), which has a documented history of off-by-one bugs in this codebase for
// any timezone ahead of UTC.
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
