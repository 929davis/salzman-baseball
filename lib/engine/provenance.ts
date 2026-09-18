// Source tagging and the two resolution rules that govern every field in the constraints
// block. See principles doc section 0.x (once written) for the full rationale -- short
// version: under-counting load and over-crediting capability are the two failure modes that
// hurt an athlete, and they need opposite resolution rules to both be blocked at once.

// carried_forward_untouched: a program row copied forward from a previous week and never
// edited since. Its structured_days is real data, but it must never count as this week's
// genuine prescribed load (that would accrue phantom load for a pitcher who's stopped being
// actively programmed -- the mirror image of the bug this project exists to fix). Callers
// building resolveLoad candidates must simply omit a carried-forward-untouched row's numbers
// (pass null, not a value tagged with this source) -- this source exists so the FACT that a
// row was excluded can still be surfaced in the block, not so it can compete in resolution.
export type Source = 'coach_asserted' | 'logged' | 'prescribed' | 'inferred' | 'unknown' | 'carried_forward_untouched'
export type Sourced<T> = { value: T, source: Source }

export function sourced<T>(value: T, source: Source): Sourced<T> {
  return { value, source }
}

// LOAD / EXPOSURE fields (weighted throw totals, I4/I5 count, high-CNS day count, plyo
// contacts, pitch counts): resolve by MAXIMUM across all sources that have a real value.
// Missing/zero candidates are ignored, not treated as "0 wins" -- a field with no sources at
// all correctly falls through to 0/'unknown' via the final fallback, not because 0 beat
// something.
export function resolveLoad(candidates: Sourced<number | null>[]): Sourced<number> {
  let best: Sourced<number> | null = null
  for (const c of candidates) {
    if (c.value == null) continue
    if (!best || c.value > best.value) best = { value: c.value, source: c.source }
  }
  return best ?? { value: 0, source: 'unknown' }
}

// CAPABILITY fields (gate status, change stage, ROM, CMJ class, training status): resolve by
// PRECEDENCE, highest-trust source wins regardless of recency. 'prescribed' has no meaning for
// a capability fact (a program doesn't assert an athlete's gate status), so it's deliberately
// excluded from this list -- only coach_asserted/logged/inferred compete here.
const CAPABILITY_PRECEDENCE: Source[] = ['coach_asserted', 'logged', 'inferred']

export function resolveCapability<T>(candidates: Sourced<T | null>[]): Sourced<T | null> {
  for (const source of CAPABILITY_PRECEDENCE) {
    const match = candidates.find(c => c.source === source && c.value != null)
    if (match) return { value: match.value, source: match.source }
  }
  return { value: null, source: 'unknown' }
}

// Special case NOT yet implemented here (needs Step G's coach_assertions table to exist first):
// a coach assertion is asymmetric for red flags / Restricted throwing_status specifically -- it
// can SET a flag or set throwing_status to Restricted (a capability fact getting more
// conservative), but it can never CLEAR a flag or move throwing_status off Restricted; only a
// dated reassessment record can do that. This is a domain-specific override on top of plain
// source precedence, not something resolveCapability's generic ranking can express -- when
// coach_assertions exists, the caller must check this rule BEFORE calling resolveCapability,
// not fold it into the precedence list.

// Render helper: every line in the constraints block that carries a resolved value shows its
// source inline, e.g. "Weekly High-CNS Days Committed: 2 [prescribed]" -- so the reader (human
// or model) can see whether a number came from what was written, what was logged, or a gap.
export function tag(source: Source): string {
  return `[${source}]`
}
