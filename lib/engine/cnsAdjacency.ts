// This one rule is week-level, not line-level -- whether two high-CNS days sit back to back is
// a property of the whole week's shape, not any single slot, so it doesn't fit the
// (athleteState, slot) -> RuleResult signature the other rules in this module share. It also
// warns rather than rejects: the caller (parseAndImportProgram) surfaces its output as an
// advisory note, never a skipped/rejected line.

export type DayCNSInput = { day: string, exercises: { cns?: string | null }[] }
export type CNSAdjacencyWarning = { day1: string, day2: string }

// A day counts as "high-CNS" if ANY exercise assigned to it (any category) is tagged
// cns:'High'. dayOrder is passed in rather than assumed, so this stays pure -- callers own
// what "the week" means (currently Monday..Sunday, no wraparound: Sunday and Monday are not
// treated as adjacent).
export function checkCNSAdjacency(days: DayCNSInput[], dayOrder: string[]): CNSAdjacencyWarning[] {
  const isHighCNSDay = (d: DayCNSInput) => d.exercises.some(e => e.cns === 'High')
  const byDay = new Map(days.map(d => [d.day, d]))
  const warnings: CNSAdjacencyWarning[] = []
  for (let i = 0; i < dayOrder.length - 1; i++) {
    const d1 = byDay.get(dayOrder[i])
    const d2 = byDay.get(dayOrder[i + 1])
    if (d1 && d2 && isHighCNSDay(d1) && isHighCNSDay(d2)) {
      warnings.push({ day1: dayOrder[i], day2: dayOrder[i + 1] })
    }
  }
  return warnings
}
