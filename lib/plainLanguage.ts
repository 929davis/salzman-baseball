// Display-only translation layer. Every function here is a pure lookup from a code already
// computed/stored elsewhere (intent level, gate, mechanical-change stage, equipment tier) to
// how a human should read it -- nothing here changes what a code MEANS, what it gates, or how
// it's computed. Do not import this into lib/engine/* or any validation/computation path; it
// exists only for UI render sites.
//
// {plain, code} always both come back -- plain for display, code for anyone who wants it (a
// small muted label, a title= tooltip, or a coach who's memorized the shorthand and wants to
// see it alongside the words).

export type PlainLabel = { plain: string; code: string }

const INTENT_LABELS: Record<string, string> = {
  I1: 'Easy',
  I2: 'Light',
  I3: 'Moderate',
  I4: 'High effort',
  I5: 'Max effort',
}

export function intentLabel(code: string | null | undefined): PlainLabel {
  const c = (code || '').toUpperCase()
  return { plain: INTENT_LABELS[c] ?? (c || 'Unknown'), code: c }
}

// G1-G4: lifting/jump-loading gates. T1-T4: throwing gates, in the order the principles doc
// (§12.3, "Gates -- what has to be true before a guy is allowed to do something") lists its
// four throwing checkpoints -- sourced from that section's actual content, not invented:
// high-intent throwing, weighted implements, pulldowns/velocity testing, then high-intent
// mechanical-change work.
const GATE_LABELS: Record<string, string> = {
  G1: 'Cleared for loaded jumps',
  G2: 'Cleared for single-leg plyo',
  G3: 'Cleared for depth jumps/KEAT',
  G4: 'Cleared for higher drop heights',
  T1: 'Cleared for high-intent throwing (I4-I5)',
  T2: 'Cleared for weighted implements',
  T3: 'Cleared for pulldowns/velocity testing',
  T4: 'Cleared for high-intent mechanical-change work',
}

export function gateLabel(code: string | null | undefined): PlainLabel {
  const c = (code || '').toUpperCase()
  return { plain: GATE_LABELS[c] ?? (c || 'Unknown'), code: c }
}

const STAGE_LABELS: Record<number, string> = {
  1: 'Learning the shape',
  2: 'Making it repeatable',
  3: 'Testing under pressure',
  4: 'Proving it live',
}

export function stageLabel(n: number | null | undefined): PlainLabel {
  const code = n == null ? '' : String(n)
  return { plain: n != null ? (STAGE_LABELS[n] ?? code) : 'Unknown', code }
}

const TIER_LABELS: Record<string, string> = {
  E1: 'Full weight room',
  E2: 'Limited weight room',
  E3: 'Bodyweight/bands',
}

export function tierLabel(code: string | null | undefined): PlainLabel {
  const c = (code || '').toUpperCase()
  return { plain: TIER_LABELS[c] ?? (c || 'Unknown'), code: c }
}
