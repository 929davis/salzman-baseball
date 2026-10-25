import { describe, it, expect, vi } from 'vitest'
import { validateTriageResult, deriveTitleFromText, runTriage } from './ideas'

// Fake supabase for the `ideas` table, faithful enough to actually simulate the race
// condition this file tests for: unlike a naive stub, `.eq()` here accumulates filters and
// only mutates/returns the row if ALL of them still match the row's CURRENT state at the
// moment the chain is actually executed (awaited or `.select()`ed) -- which is exactly the
// property runTriage's atomic conditional status update relies on. `setRow` lets a test
// mutate the row out-of-band, from inside a fake `fetch` call, to simulate a human action
// landing while the real Claude call would still be in flight.
type FakeIdeaRow = { id: string, title: string, details: string, status: string } & Record<string, unknown>

function makeFakeSupabase(initial: FakeIdeaRow) {
  let row: FakeIdeaRow = { ...initial }
  const appliedUpdates: Record<string, unknown>[] = []

  type FilterChain = {
    eq(col: string, val: unknown): FilterChain
    select(cols?: string): Promise<{ data: FakeIdeaRow[], error: null }>
    maybeSingle(): Promise<{ data: FakeIdeaRow | null, error: null }>
    then<T>(resolve: (v: { data: FakeIdeaRow[], error: null }) => T, reject?: (e: unknown) => T): Promise<T>
  }

  function filterChain(pendingUpdate: Record<string, unknown> | null, filters: [string, unknown][]): FilterChain {
    const matchesNow = () => filters.every(([col, val]) => row[col] === val)
    const applyIfMatched = (): FakeIdeaRow[] => {
      if (!matchesNow()) return []
      if (pendingUpdate) {
        appliedUpdates.push(pendingUpdate)
        row = { ...row, ...pendingUpdate }
      }
      return [row]
    }
    const chain: FilterChain = {
      eq(col: string, val: unknown) {
        return filterChain(pendingUpdate, [...filters, [col, val]])
      },
      // Terminal call used after .update(...).eq(...)...eq(...) -- executes the pending
      // update (if any) against the row's state right now, and returns what matched.
      select() {
        return Promise.resolve({ data: applyIfMatched(), error: null })
      },
      // Terminal call used for the initial read: from('ideas').select(...).eq(...).maybeSingle()
      maybeSingle() {
        return Promise.resolve({ data: matchesNow() ? row : null, error: null })
      },
      // Lets `.update(...).eq('id', id)` be awaited directly, with no `.select()` --
      // mirrors how runTriage's Step 1 (unconditional advisory-fields write) calls it.
      then<T>(resolve: (v: { data: FakeIdeaRow[], error: null }) => T, reject?: (e: unknown) => T) {
        return Promise.resolve({ data: applyIfMatched(), error: null }).then(resolve, reject)
      },
    }
    return chain
  }

  const supabase = {
    from(table: string) {
      if (table !== 'ideas') throw new Error(`unexpected table: ${table}`)
      return {
        select() { return filterChain(null, []) },
        update(payload: Record<string, unknown>) { return filterChain(payload, []) },
      }
    },
  }
  return {
    supabase,
    appliedUpdates,
    getRow: () => row,
    // Mutates the row directly, bypassing runTriage entirely -- stands in for "a human
    // clicked Approve/Reject in the UI" happening at an arbitrary point in time.
    setRow: (patch: Record<string, unknown>) => { row = { ...row, ...patch } },
  }
}

function fakeFetchOk(toolInput: Record<string, unknown>) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'tool_use', name: 'submit_triage', input: toolInput }] }),
  })) as unknown as typeof fetch
}

// Simulates the Claude HTTP call itself being the moment a human action lands -- i.e. "while
// the AI request is pending." `onInFlight` runs synchronously before the fake response
// resolves, exactly standing in for an Approve/Reject click that commits during the real
// (multi-second) network call this fetch is standing in for.
function fakeFetchOkWithConcurrentChange(toolInput: Record<string, unknown>, onInFlight: () => void) {
  return vi.fn(async () => {
    onInFlight()
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'tool_use', name: 'submit_triage', input: toolInput }] }),
    }
  }) as unknown as typeof fetch
}

const VALID_TRIAGE = {
  category: 'content', time_saving: 'medium', revenue_potential: 'low',
  research_needed: false, research_notes: '', recommended_action: 'Post a reel about EV theory.',
  rationale: 'Clear content idea with existing data behind it.', confidence: 'high',
}

describe('validateTriageResult', () => {
  it('accepts a fully valid object', () => {
    const result = validateTriageResult(VALID_TRIAGE)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.category).toBe('content')
  })

  it('rejects a non-object', () => {
    expect(validateTriageResult('nope').ok).toBe(false)
    expect(validateTriageResult(null).ok).toBe(false)
  })

  it('rejects an invalid category', () => {
    const result = validateTriageResult({ ...VALID_TRIAGE, category: 'marketing' })
    expect(result.ok).toBe(false)
  })

  it('rejects an invalid time_saving bucket', () => {
    const result = validateTriageResult({ ...VALID_TRIAGE, time_saving: 'extreme' })
    expect(result.ok).toBe(false)
  })

  it('rejects a non-boolean research_needed', () => {
    const result = validateTriageResult({ ...VALID_TRIAGE, research_needed: 'yes' })
    expect(result.ok).toBe(false)
  })

  it('rejects an empty recommended_action', () => {
    const result = validateTriageResult({ ...VALID_TRIAGE, recommended_action: '   ' })
    expect(result.ok).toBe(false)
  })

  it('rejects an empty rationale', () => {
    const result = validateTriageResult({ ...VALID_TRIAGE, rationale: '' })
    expect(result.ok).toBe(false)
  })

  it('rejects a missing confidence field', () => {
    const { confidence: _confidence, ...withoutConfidence } = VALID_TRIAGE
    const result = validateTriageResult(withoutConfidence)
    expect(result.ok).toBe(false)
  })
})

describe('deriveTitleFromText', () => {
  it('returns short text unchanged', () => {
    expect(deriveTitleFromText('Short idea')).toBe('Short idea')
  })

  it('trims surrounding whitespace', () => {
    expect(deriveTitleFromText('  Short idea  ')).toBe('Short idea')
  })

  it('truncates long text to 80 chars total, ending in ...', () => {
    const long = 'x'.repeat(200)
    const title = deriveTitleFromText(long)
    expect(title.length).toBe(80)
    expect(title.endsWith('...')).toBe(true)
  })
})

describe('runTriage', () => {
  it('returns a 404-equivalent error when the idea does not exist', async () => {
    const { supabase } = makeFakeSupabase({ id: 'other', title: 'T', details: 'D', status: 'new' })
    const result = await runTriage({ supabase, fetchImpl: fakeFetchOk(VALID_TRIAGE), ideaId: 'missing', apiKey: 'k' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(404)
  })

  it('on success, writes ai_* fields and advances status new -> triaged', async () => {
    const { supabase, getRow } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'new' })
    const result = await runTriage({ supabase, fetchImpl: fakeFetchOk(VALID_TRIAGE), ideaId: '1', apiKey: 'k' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.statusAdvanced).toBe(true)
    expect(getRow().status).toBe('triaged')
    expect(getRow().ai_category).toBe('content')
    expect(getRow().ai_triage_error).toBe(null)
  })

  it('on success, does NOT change status if the idea was already approved before triage even started', async () => {
    const { supabase, getRow } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'approved' })
    const result = await runTriage({ supabase, fetchImpl: fakeFetchOk(VALID_TRIAGE), ideaId: '1', apiKey: 'k' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.statusAdvanced).toBe(false)
    expect(getRow().status).toBe('approved')
    // ai_* fields are still advisory data, saved regardless:
    expect(getRow().ai_category).toBe('content')
  })

  // The exact regression scenario from the preflight review: triage begins while status is
  // 'new'; a human approves the idea while the (simulated) Claude call is still in flight;
  // the AI response then completes. The final status must be 'approved', not silently
  // reverted to 'triaged'.
  it('REGRESSION: a concurrent human approval during the Claude call is preserved, not overwritten', async () => {
    const { supabase, getRow, setRow } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'new' })
    const fetchWithConcurrentApproval = fakeFetchOkWithConcurrentChange(VALID_TRIAGE, () => {
      setRow({ status: 'approved' }) // the human's click, landing mid-flight
    })
    const result = await runTriage({ supabase, fetchImpl: fetchWithConcurrentApproval, ideaId: '1', apiKey: 'k' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.statusAdvanced).toBe(false)
    expect(getRow().status).toBe('approved')
    // the triage output itself is still advisory data worth keeping:
    expect(getRow().ai_category).toBe('content')
    expect(getRow().ai_triage_error).toBe(null)
  })

  // Same protection, for the other human decision.
  it('REGRESSION: a concurrent human rejection during the Claude call is preserved, not overwritten', async () => {
    const { supabase, getRow, setRow } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'new' })
    const fetchWithConcurrentRejection = fakeFetchOkWithConcurrentChange(VALID_TRIAGE, () => {
      setRow({ status: 'rejected' })
    })
    const result = await runTriage({ supabase, fetchImpl: fetchWithConcurrentRejection, ideaId: '1', apiKey: 'k' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.statusAdvanced).toBe(false)
    expect(getRow().status).toBe('rejected')
  })

  it('concurrent retries: a second triage call after the first already advanced status does not re-advance or error', async () => {
    const { supabase, getRow } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'new' })
    const first = await runTriage({ supabase, fetchImpl: fakeFetchOk(VALID_TRIAGE), ideaId: '1', apiKey: 'k' })
    expect(first.ok).toBe(true)
    if (first.ok) expect(first.statusAdvanced).toBe(true)
    expect(getRow().status).toBe('triaged')

    const second = await runTriage({ supabase, fetchImpl: fakeFetchOk(VALID_TRIAGE), ideaId: '1', apiKey: 'k' })
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.statusAdvanced).toBe(false) // already 'triaged', not 'new' anymore
    expect(getRow().status).toBe('triaged') // unchanged, no error, no duplicate advance
  })

  it('marks ai_triage_error and returns an error when the network call throws, leaving status untouched', async () => {
    const { supabase, getRow } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'new' })
    const failingFetch = vi.fn(async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch
    const result = await runTriage({ supabase, fetchImpl: failingFetch, ideaId: '1', apiKey: 'k' })
    expect(result.ok).toBe(false)
    expect(getRow().ai_triage_error).toMatch(/ECONNRESET/)
    expect(getRow().status).toBe('new')
    expect(getRow().title).toBe('T')
  })

  it('marks ai_triage_error and returns an error when Claude responds with a non-OK status', async () => {
    const { supabase, getRow } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'new' })
    const badFetch = vi.fn(async () => ({
      ok: false, status: 529, json: async () => ({ error: { message: 'overloaded' } }),
    })) as unknown as typeof fetch
    const result = await runTriage({ supabase, fetchImpl: badFetch, ideaId: '1', apiKey: 'k' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/overloaded/)
    expect(getRow().ai_triage_error).toMatch(/overloaded/)
    expect(getRow().status).toBe('new')
  })

  it('marks ai_triage_error and returns an error when no tool_use block is present', async () => {
    const { supabase, getRow } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'new' })
    const noToolFetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'I refuse to use tools today.' }] }),
    })) as unknown as typeof fetch
    const result = await runTriage({ supabase, fetchImpl: noToolFetch, ideaId: '1', apiKey: 'k' })
    expect(result.ok).toBe(false)
    expect(getRow().ai_triage_error).toMatch(/structured triage/)
    expect(getRow().status).toBe('new')
  })

  it('marks ai_triage_error and returns an error when the tool input fails validation', async () => {
    const { supabase, getRow } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'new' })
    const badInputFetch = fakeFetchOk({ ...VALID_TRIAGE, category: 'not-a-real-category' })
    const result = await runTriage({ supabase, fetchImpl: badInputFetch, ideaId: '1', apiKey: 'k' })
    expect(result.ok).toBe(false)
    expect(getRow().ai_triage_error).toMatch(/validation/)
    expect(getRow().status).toBe('new')
  })

  it('is safe to call twice in a row on the same idea (duplicate/repeat submissions)', async () => {
    const { supabase, appliedUpdates } = makeFakeSupabase({ id: '1', title: 'T', details: 'D', status: 'new' })
    await runTriage({ supabase, fetchImpl: fakeFetchOk(VALID_TRIAGE), ideaId: '1', apiKey: 'k' })
    await runTriage({ supabase, fetchImpl: fakeFetchOk(VALID_TRIAGE), ideaId: '1', apiKey: 'k' })
    // First call: fields write + status advance = 2 applied updates. Second call: fields
    // write applies, but the status-advance update no longer matches (already 'triaged'), so
    // only 3 applied updates total, not 4 -- and no error either way.
    expect(appliedUpdates.length).toBe(3)
  })
})
