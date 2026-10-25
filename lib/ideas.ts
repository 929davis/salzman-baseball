// Shared types + pure logic for the Ideas intake/triage workflow (Salzman Baseball OS,
// Phase 1). The Anthropic call and all its branching live in `runTriage` below, written to
// take its dependencies (supabase client, fetch impl) as arguments rather than importing
// them directly -- that's what lets this file be unit-tested with a fake supabase/fetch
// instead of hitting a real database or a real (billed) Claude API call. See ideas.test.ts.
//
// app/api/ideas/triage/route.ts is a thin wrapper: it only does auth + env-var presence,
// then calls runTriage. Nothing outside runTriage ever writes an `ai_*` column.

export const IDEA_STATUSES = ['new', 'triaged', 'approved', 'rejected', 'in_progress'] as const
export type IdeaStatus = typeof IDEA_STATUSES[number]

export const IDEA_SOURCES = ['manual', 'question_radar'] as const
export type IdeaSource = typeof IDEA_SOURCES[number]

export const AI_CATEGORIES = ['content', 'research', 'product', 'business'] as const
export type AiCategory = typeof AI_CATEGORIES[number]

export const AI_LEVELS = ['low', 'medium', 'high'] as const
export type AiLevel = typeof AI_LEVELS[number]

export type TriageResult = {
  category: AiCategory
  time_saving: AiLevel
  revenue_potential: AiLevel
  research_needed: boolean
  research_notes: string
  recommended_action: string
  rationale: string
  confidence: AiLevel
}

export type TriageValidation =
  | { ok: true, data: TriageResult }
  | { ok: false, error: string }

// Truncates to a title the same way sql/ideas.sql's one-time radar_ideas migration does
// (left(text,77) || '...' when over 80 chars) -- kept in sync deliberately so a manually
// entered idea's auto-derived title (if the UI ever offers one) matches the migrated rows'
// shape exactly, not two slightly different truncation rules.
export function deriveTitleFromText(text: string, maxLen = 80): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return trimmed.slice(0, maxLen - 3) + '...'
}

// Strict validation of the AI's structured tool-call input. Every field is checked against
// its exact enum/type -- an unrecognized category or a missing field fails closed (the idea
// row keeps its previous ai_* values / error state) rather than silently storing a partial
// or malformed triage result.
export function validateTriageResult(raw: unknown): TriageValidation {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'AI response was not an object.' }
  }
  const r = raw as Record<string, unknown>

  if (typeof r.category !== 'string' || !AI_CATEGORIES.includes(r.category as AiCategory)) {
    return { ok: false, error: `Invalid or missing category: ${JSON.stringify(r.category)}` }
  }
  if (typeof r.time_saving !== 'string' || !AI_LEVELS.includes(r.time_saving as AiLevel)) {
    return { ok: false, error: `Invalid or missing time_saving: ${JSON.stringify(r.time_saving)}` }
  }
  if (typeof r.revenue_potential !== 'string' || !AI_LEVELS.includes(r.revenue_potential as AiLevel)) {
    return { ok: false, error: `Invalid or missing revenue_potential: ${JSON.stringify(r.revenue_potential)}` }
  }
  if (typeof r.research_needed !== 'boolean') {
    return { ok: false, error: `research_needed must be a boolean, got: ${JSON.stringify(r.research_needed)}` }
  }
  if (typeof r.research_notes !== 'string') {
    return { ok: false, error: `research_notes must be a string, got: ${JSON.stringify(r.research_notes)}` }
  }
  if (typeof r.recommended_action !== 'string' || r.recommended_action.trim() === '') {
    return { ok: false, error: 'recommended_action must be a non-empty string.' }
  }
  if (typeof r.rationale !== 'string' || r.rationale.trim() === '') {
    return { ok: false, error: 'rationale must be a non-empty string.' }
  }
  if (typeof r.confidence !== 'string' || !AI_LEVELS.includes(r.confidence as AiLevel)) {
    return { ok: false, error: `Invalid or missing confidence: ${JSON.stringify(r.confidence)}` }
  }

  return {
    ok: true,
    data: {
      category: r.category as AiCategory,
      time_saving: r.time_saving as AiLevel,
      revenue_potential: r.revenue_potential as AiLevel,
      research_needed: r.research_needed,
      research_notes: r.research_notes,
      recommended_action: r.recommended_action.trim(),
      rationale: r.rationale.trim(),
      confidence: r.confidence as AiLevel,
    },
  }
}

// Forces Claude to answer via a single tool call instead of free text -- the "structured
// output" the spec asks for. tool_choice below pins the model to calling exactly this tool.
export const TRIAGE_TOOL = {
  name: 'submit_triage',
  description: 'Submit the structured triage assessment for this business idea.',
  input_schema: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: AI_CATEGORIES as unknown as string[] },
      time_saving: { type: 'string', enum: AI_LEVELS as unknown as string[] },
      revenue_potential: { type: 'string', enum: AI_LEVELS as unknown as string[] },
      research_needed: { type: 'boolean' },
      research_notes: { type: 'string' },
      recommended_action: { type: 'string' },
      rationale: { type: 'string' },
      confidence: { type: 'string', enum: AI_LEVELS as unknown as string[] },
    },
    required: [
      'category', 'time_saving', 'revenue_potential', 'research_needed',
      'research_notes', 'recommended_action', 'rationale', 'confidence',
    ],
  },
}

export function buildTriagePrompt(title: string, details: string): string {
  return `You are triaging a raw business idea for a youth/amateur baseball pitching-development company (coaching, content, and a training-tech product). Classify it honestly and conservatively.

Title: ${title}
Details: ${details || '(no additional details provided)'}

Rules:
- category: the single best fit -- "content" (social/video/article), "research" (needs investigation before anything else can happen), "product" (a feature/tool to build), or "business" (ops, partnerships, monetization, hiring).
- time_saving / revenue_potential: coarse low/medium/high buckets only. Do NOT invent a specific dollar figure, percentage, or hours-saved number -- a one-paragraph idea doesn't carry enough information to support a precise estimate, and a fabricated-sounding number is worse than an honest bucket.
- research_needed: true only if this idea genuinely can't be acted on without first verifying a fact, checking a competitor, or testing a claim.
- research_notes: what specifically would need to be checked. Use an empty string if research_needed is false.
- recommended_action: one concrete next step, not a multi-step plan.
- rationale: 1-2 sentences on why you classified it this way.
- confidence: your own confidence in this classification, given how much detail was in the idea.

Call submit_triage with your assessment.`
}

export type RunTriageResult =
  // `statusAdvanced` tells the caller whether this call actually moved the idea from
  // 'new' to 'triaged', or left status alone because it was no longer 'new' by the time
  // the conditional update ran (a human already approved/rejected it, or another
  // triage call already advanced it first). Callers should surface this rather than
  // assume status always moves forward -- see runTriage's comment below.
  | { ok: true, data: TriageResult, statusAdvanced: boolean }
  | { ok: false, error: string, status: number }

// The full triage orchestration: load the idea, call Claude, validate, write the result back.
// Takes `supabase` and `fetchImpl` as parameters specifically so this can be unit-tested
// without a real database or a real (billed) network call -- see ideas.test.ts for the fake
// implementations used there. The real route (app/api/ideas/triage/route.ts) passes the real
// server-side supabase client and the real global `fetch`.
//
// `supabase: any` is deliberate, not sloppy: this function must accept either the real
// SupabaseClient (whose query-builder return type is a non-Promise PostgrestBuilder with its
// own thenable machinery, not safely nameable in a small hand-written interface) or the fake
// thenable-chain stub ideas.test.ts uses. A hand-rolled structural type for this was tried and
// rejected -- it made real Supabase calls fail to type-check (PostgrestBuilder isn't a plain
// Promise) while also being too strict for the deliberately looser test fakes.
export async function runTriage(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  fetchImpl: typeof fetch
  ideaId: string
  apiKey: string
  model?: string
}): Promise<RunTriageResult> {
  const { supabase, fetchImpl, ideaId, apiKey, model = 'claude-sonnet-5' } = opts

  // Deliberately does NOT select `status` here. An earlier version checked
  // `idea.status === 'new'` against this initial read and used that stale snapshot to decide
  // whether to write `status: 'triaged'` after the (multi-second) Claude call below -- a
  // human clicking Approve/Reject in that window would get silently overwritten back to
  // 'triaged' once this function's own write landed later. The fix is below: the status
  // transition is re-checked AND written in one atomic conditional UPDATE, at the latest
  // possible moment, instead of being decided from a value read before the slow part ran.
  const { data: idea, error: ideaError } = await supabase
    .from('ideas').select('id,title,details').eq('id', ideaId).maybeSingle()
  if (ideaError) return { ok: false, error: `Could not load idea: ${ideaError.message}`, status: 500 }
  if (!idea) return { ok: false, error: 'Idea not found.', status: 404 }

  const markError = async (message: string) => {
    await supabase.from('ideas')
      .update({ ai_triage_error: message, updated_at: new Date().toISOString() })
      .eq('id', ideaId)
  }

  let res: Response
  try {
    res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        tools: [TRIAGE_TOOL],
        tool_choice: { type: 'tool', name: 'submit_triage' },
        messages: [{ role: 'user', content: buildTriagePrompt(idea.title, idea.details || '') }],
      }),
    })
  } catch (err: unknown) {
    const message = `Could not reach Claude: ${err instanceof Error ? err.message : String(err)}`
    await markError(message)
    return { ok: false, error: message, status: 502 }
  }

  type AnthropicContentBlock = { type: string, name?: string, input?: unknown }
  type AnthropicResponse = { error?: { message?: string }, content?: AnthropicContentBlock[] }

  const payload: AnthropicResponse | null = await res.json().catch(() => null)
  if (!res.ok || !payload) {
    const message = payload?.error?.message || `Claude returned ${res.status}.`
    await markError(message)
    return { ok: false, error: message, status: 502 }
  }

  const toolUse = Array.isArray(payload.content)
    ? payload.content.find((c) => c?.type === 'tool_use' && c?.name === 'submit_triage')
    : null
  if (!toolUse) {
    const message = 'Claude did not return a structured triage result.'
    await markError(message)
    return { ok: false, error: message, status: 502 }
  }

  const validation = validateTriageResult(toolUse.input)
  if (!validation.ok) {
    const message = `Claude's response failed validation: ${validation.error}`
    await markError(message)
    return { ok: false, error: message, status: 502 }
  }

  const t = validation.data
  const now = new Date().toISOString()

  // Step 1: always persist the triage output itself. This is advisory data -- safe to write
  // no matter what the idea's current status is, and it never touches `status`.
  const { error: fieldsError } = await supabase.from('ideas').update({
    ai_category: t.category,
    ai_time_saving: t.time_saving,
    ai_revenue_potential: t.revenue_potential,
    ai_research_needed: t.research_needed,
    ai_research_notes: t.research_notes,
    ai_recommended_action: t.recommended_action,
    ai_rationale: t.rationale,
    ai_confidence: t.confidence,
    ai_triaged_at: now,
    ai_triage_error: null,
    updated_at: now,
  }).eq('id', ideaId)
  if (fieldsError) return { ok: false, error: `Triage succeeded but saving failed: ${fieldsError.message}`, status: 500 }

  // Step 2: advance new -> triaged, but only as a single atomic conditional UPDATE whose
  // WHERE clause re-checks `status = 'new'` at the exact moment this statement executes --
  // not against the `idea` read at the top of this function, which can be arbitrarily stale
  // by now (the Claude call above can take seconds). Postgres evaluates a statement's WHERE
  // and SET together, under the row's lock, so whichever write actually commits first wins:
  // if a human's Approve/Reject already committed before this runs, `status` is no longer
  // 'new', this UPDATE matches zero rows, and the human's decision is left untouched -- it is
  // never read-then-blindly-overwritten. The same guard protects 'rejected' (or any other
  // non-'new' status) for free, since the WHERE only ever matches 'new' specifically.
  const { data: advanced, error: advanceError } = await supabase
    .from('ideas')
    .update({ status: 'triaged', updated_at: now })
    .eq('id', ideaId)
    .eq('status', 'new')
    .select('status')
  if (advanceError) return { ok: false, error: `Triage saved but the status update failed: ${advanceError.message}`, status: 500 }

  const statusAdvanced = Array.isArray(advanced) && advanced.length > 0
  return { ok: true, data: t, statusAdvanced }
}
