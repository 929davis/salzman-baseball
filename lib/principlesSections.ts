// Selection logic for assembling the program-writing prompt (buildPrompt, app/coach/page.tsx)
// out of principles_sections rows instead of the old single principles.content blob. Kept in
// lib/ (not inline in the page) so it's one testable, single-sourced place for a rule that
// matters: what actually gets shown to the AI writing this pitcher's program.

export type PrinciplesSection = {
  id: string
  doc: string
  section_number: string
  title: string
  body: string
  // Pure metadata: marks a section as deterministic / a candidate for eventual lib/engine
  // implementation. Deliberately NOT read by selectPrinciplesSections -- see always_include.
  is_engine_rule: boolean
  // The actual "show this to the model on every prompt regardless of athlete context" flag.
  // Was previously (incorrectly) conflated with is_engine_rule -- every is_engine_rule=true
  // row was unconditionally included in every prompt, which produced 85,689 chars of
  // always-included content against a 40,000 budget for a real pitcher, crowding out every
  // tag-matched situational section. See sql/principles_always_include.sql.
  always_include: boolean
  tags: string[]
  sort_order: number
  updated_at: string | null
}

// Default prompt character budget. Configurable per-call (buildPrompt can override) rather
// than hardcoded, since what fits comfortably in an external Claude chat may change.
export const PRINCIPLES_PROMPT_CHAR_BUDGET = 40000

export type PrinciplesSelection = {
  included: PrinciplesSection[]   // engine-rule + context-matched sections that made the cut, doc reading order
  omitted: PrinciplesSection[]    // context-matched sections dropped for budget, lowest sort_order first
  totalChars: number              // sum of included sections' body length
}

// Rule: every always_include section is always included, no matter what. Every other section
// is included only if at least one of its tags appears in contextTags. If the combined body
// text of everything that qualifies exceeds charBudget, the lowest-sort_order NON-always-include
// sections are dropped first until it fits (always_include sections are never dropped for
// budget -- if that content alone exceeds the budget, that's a real "your always-include set
// got too long" problem for a human to notice and fix, not something to silently truncate).
export function selectPrinciplesSections(
  sections: PrinciplesSection[],
  contextTags: string[],
  charBudget: number = PRINCIPLES_PROMPT_CHAR_BUDGET,
): PrinciplesSelection {
  const alwaysInclude = sections.filter(s => s.always_include)
  const contextMatched = sections
    .filter(s => !s.always_include && s.tags.some(t => contextTags.includes(t)))
    .sort((a, b) => a.sort_order - b.sort_order)

  const alwaysIncludeChars = alwaysInclude.reduce((sum, s) => sum + s.body.length, 0)
  let runningChars = alwaysIncludeChars
  const included: PrinciplesSection[] = [...alwaysInclude]
  const omitted: PrinciplesSection[] = []

  for (const s of contextMatched) {
    if (runningChars + s.body.length <= charBudget) {
      included.push(s)
      runningChars += s.body.length
    } else {
      omitted.push(s)
    }
  }

  included.sort((a, b) => a.sort_order - b.sort_order)
  return { included, omitted, totalChars: runningChars }
}

// Renders the chosen sections into the text block buildPrompt splices into the prompt, plus a
// human-readable note when something got dropped for budget -- so the coach (and the AI itself)
// can see a section is missing rather than the prompt just quietly being shorter than expected.
export function formatPrinciplesForPrompt(selection: PrinciplesSelection, charBudget: number): string {
  const body = selection.included
    .map(s => `### [${s.doc}] ${s.section_number} — ${s.title}\n${s.body}`)
    .join('\n\n')
  if (selection.omitted.length === 0) return body
  const omittedList = selection.omitted.map(s => `${s.doc} ${s.section_number}`).join(', ')
  return `${body}\n\n(NOTE: ${selection.omitted.length} section(s) omitted to stay under the ${charBudget.toLocaleString()}-character prompt budget: ${omittedList}.)`
}

// Short summary for the "which sections was the AI actually given" UI line and console log.
export function summarizePrinciplesSelection(selection: PrinciplesSelection): string {
  const alwaysCount = selection.included.filter(s => s.always_include).length
  const contextCount = selection.included.length - alwaysCount
  const omittedNote = selection.omitted.length > 0 ? `, ${selection.omitted.length} omitted (budget)` : ''
  return `${selection.included.length} section(s) included (${alwaysCount} always-include, ${contextCount} context)${omittedNote}`
}
