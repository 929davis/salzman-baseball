// Assembles the program-writing prompt (buildPrompt, app/coach/page.tsx) out of
// principles_sections rows. Kept in lib/ (not inline in the page) so it's one testable,
// single-sourced place for a rule that matters: what actually gets shown to the AI writing
// this pitcher's program.
//
// Formerly did tag-based selective inclusion against a character budget (see git history --
// selectPrinciplesSections). That approach produced the same bug twice: an "always include"
// subset silently grew past the budget (first 85,689 chars against 40,000 via is_engine_rule,
// then 56,466 against 40,000 via always_include after a later review), which meant every
// situational, tag-matched section got silently dropped for every pitcher, every time, with
// no visible signal that anything was missing. The full document is ~88,000 chars -- small
// for a model with a context window in the hundreds of thousands of tokens -- so there's no
// real constraint that selective inclusion was solving. The computed constraints block
// buildPrompt sends alongside this (season_phase, throwing_status, active_change, gates_passed,
// etc.) already tells the AI which parts of the document apply to this athlete right now; it
// doesn't need the document pre-filtered on its behalf. `tags` and `always_include` stay on
// the row as organizational metadata (the Principles tab UI, future search) but no longer
// function as an inclusion filter.

export type PrinciplesSection = {
  id: string
  doc: string
  section_number: string
  title: string
  body: string
  is_engine_rule: boolean
  always_include: boolean
  tags: string[]
  sort_order: number
  updated_at: string | null
}

// Not an enforced limit -- nothing is ever dropped. A soft sanity check so a human notices if
// the document grows large enough to be worth reconsidering, instead of it silently ballooning
// forever with no one watching.
export const PRINCIPLES_SANITY_CEILING = 150000

export type PrinciplesBundle = {
  sections: PrinciplesSection[]  // every section, sort_order order
  totalChars: number
}

export function bundleAllPrinciples(sections: PrinciplesSection[]): PrinciplesBundle {
  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order)
  const totalChars = sorted.reduce((sum, s) => sum + s.body.length, 0)
  if (totalChars > PRINCIPLES_SANITY_CEILING) {
    console.warn(`[principlesSections] full document is ${totalChars.toLocaleString()} chars, above the ${PRINCIPLES_SANITY_CEILING.toLocaleString()}-char sanity ceiling -- consider trimming.`)
  }
  return { sections: sorted, totalChars }
}

// Renders every section into the text block buildPrompt splices into the prompt.
export function formatPrinciplesForPrompt(bundle: PrinciplesBundle): string {
  return bundle.sections
    .map(s => `### [${s.doc}] ${s.section_number} — ${s.title}\n${s.body}`)
    .join('\n\n')
}

// Short summary for the "what was the AI actually given" UI line and console log.
export function summarizePrinciples(bundle: PrinciplesBundle): string {
  return `${bundle.sections.length} section(s) sent (full document), ~${bundle.totalChars.toLocaleString()} chars`
}
