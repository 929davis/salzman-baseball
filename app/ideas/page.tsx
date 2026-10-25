'use client'
// Idea Intake + AI Triage (Salzman Baseball OS, Phase 1). Coach-only, mirrors the auth-gate
// and card/button styling of app/social/radar/page.tsx. Submitting an idea writes one row
// to `ideas` (source='manual') and immediately asks app/api/ideas/triage/route.ts to classify
// it; if that fails the idea row is untouched except for ai_triage_error, and "Retry triage"
// re-runs the same call. Approve/Reject/Start are plain client-side status updates -- same
// direct-write pattern as radar's toggleSource -- and touch nothing but this row's `status`.
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { IDEA_STATUSES, type IdeaStatus, type AiCategory, type AiLevel } from '@/lib/ideas'

const C = {
  bg: '#0d1117', bg2: '#161b22', bg3: '#1c2333', border: '#30363d',
  gold: '#e8b84b', teal: '#39d353', red: '#f85149', blue: '#58a6ff',
  text: '#e6edf3', textMuted: '#7d8590', textDim: '#484f58',
}

type Idea = {
  id: string
  title: string
  details: string
  source: 'manual' | 'question_radar'
  status: IdeaStatus
  ai_category: AiCategory | null
  ai_time_saving: AiLevel | null
  ai_revenue_potential: AiLevel | null
  ai_research_needed: boolean | null
  ai_research_notes: string | null
  ai_recommended_action: string | null
  ai_rationale: string | null
  ai_confidence: AiLevel | null
  ai_triaged_at: string | null
  ai_triage_error: string | null
  created_at: string
}

const STATUS_LABELS: Record<IdeaStatus, string> = {
  new: 'New', triaged: 'Triaged', approved: 'Approved', rejected: 'Rejected', in_progress: 'In Progress',
}
const STATUS_COLORS: Record<IdeaStatus, string> = {
  new: C.textMuted, triaged: C.blue, approved: C.teal, rejected: C.red, in_progress: C.gold,
}

const btn = (variant: 'gold' | 'default' | 'danger' = 'default', disabled = false): React.CSSProperties => ({
  background: disabled ? C.bg3 : variant === 'gold' ? C.gold : variant === 'danger' ? C.red : C.bg3,
  color: disabled ? C.textDim : variant === 'gold' || variant === 'danger' ? C.bg : C.text,
  border: `1px solid ${disabled ? C.border : variant === 'gold' ? C.gold : variant === 'danger' ? C.red : C.border}`,
  borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
})
const smallBtn = (variant: 'default' | 'danger' = 'default', disabled = false): React.CSSProperties => ({
  background: 'transparent',
  color: disabled ? C.textDim : variant === 'danger' ? C.red : C.textMuted,
  border: `1px solid ${disabled ? C.border : variant === 'danger' ? C.red : C.border}`,
  borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
})
const input: React.CSSProperties = {
  background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px',
  fontSize: 14, color: C.text, outline: 'none', width: '100%', boxSizing: 'border-box',
}
const textarea: React.CSSProperties = { ...input, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }
const card: React.CSSProperties = { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }

function badge(label: string, color: string) {
  return <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color, border: `1px solid ${color}`, borderRadius: 5, padding: '2px 7px' }}>{label}</span>
}

export default function IdeasPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [ideas, setIdeas] = useState<Idea[]>([])

  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Which idea is currently mid-triage (new submission or a "Retry triage" click) -- disables
  // that idea's own triage button so a double-click can't fire two overlapping requests.
  const [triagingId, setTriagingId] = useState<string | null>(null)
  // Per-idea note shown after a triage call completes but did NOT advance status -- this
  // happens when a human approved/rejected the idea while the Claude call was in flight (see
  // lib/ideas.ts's runTriage). The idea's status itself is never silently reverted; this just
  // makes that outcome visible instead of leaving the coach to wonder why nothing changed.
  const [triageNotes, setTriageNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data } = await supabase.from('ideas').select('*').order('created_at', { ascending: false })
    setIdeas((data || []) as Idea[])
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'coach') { router.push('/pitcher'); return }
      await load()
      setLoading(false)
    }
    init()
  }, [supabase, router, load])

  const triage = async (ideaId: string) => {
    setTriagingId(ideaId)
    setTriageNotes(n => { const { [ideaId]: _omit, ...rest } = n; return rest })
    try {
      const res = await fetch('/api/ideas/triage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ideaId }),
      })
      const body = await res.json().catch(() => null)
      if (res.ok && body?.ok && body.statusAdvanced === false) {
        setTriageNotes(n => ({ ...n, [ideaId]: 'Triage saved, but status was left as-is -- this idea was already approved/rejected.' }))
      }
      // Errors land in ai_triage_error on the row itself (written by the route even on
      // failure) -- reloading is enough to show the result either way, success or error.
      await load()
    } catch {
      await load()
    }
    setTriagingId(null)
  }

  const submitIdea = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('ideas').insert({
      title: title.trim(), details: details.trim(), source: 'manual', created_by: user?.id ?? null,
    }).select('id').single()
    if (error || !data) {
      setSubmitError(error?.message || 'Could not save idea.')
      setSubmitting(false)
      return
    }
    setTitle(''); setDetails('')
    await load()
    setSubmitting(false)
    await triage(data.id)
  }

  const setStatus = async (idea: Idea, status: IdeaStatus) => {
    await supabase.from('ideas').update({ status, updated_at: new Date().toISOString() }).eq('id', idea.id)
    await load()
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontFamily: 'system-ui' }}>Loading...</div>
  }

  const grouped = new Map<IdeaStatus, Idea[]>()
  for (const s of IDEA_STATUSES) grouped.set(s, [])
  for (const idea of ideas) grouped.get(idea.status)?.push(idea)

  return (
    <main style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 720, margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>Ideas</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{ideas.length} total</div>
        </div>
        <button onClick={() => router.push('/social')} style={smallBtn()}>← Back to Composer</button>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>New Idea</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={input} placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
          <textarea style={textarea} placeholder="Details (optional)" value={details} onChange={e => setDetails(e.target.value)} maxLength={4000} />
          <button onClick={submitIdea} disabled={!title.trim() || submitting} style={btn('gold', !title.trim() || submitting)}>
            {submitting ? 'Saving…' : 'Submit idea'}
          </button>
          {submitError && <div style={{ fontSize: 12, color: C.red }}>{submitError}</div>}
        </div>
      </div>

      {IDEA_STATUSES.map(status => {
        const list = grouped.get(status) || []
        if (list.length === 0) return null
        return (
          <div key={status} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLORS[status], textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              {STATUS_LABELS[status]} ({list.length})
            </div>
            {list.map(idea => {
              const isTriaging = triagingId === idea.id
              const needsTriage = !idea.ai_triaged_at && !idea.ai_triage_error
              return (
                <div key={idea.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{idea.title}</div>
                    {badge(idea.source === 'question_radar' ? 'Question Radar' : 'Manual', C.textDim)}
                  </div>
                  {idea.details && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{idea.details}</div>}

                  {idea.ai_triage_error && (
                    <div style={{ fontSize: 11, color: C.red, marginBottom: 8, background: 'rgba(248,81,73,0.08)', border: `1px solid ${C.red}`, borderRadius: 6, padding: '6px 8px' }}>
                      Triage failed: {idea.ai_triage_error}
                    </div>
                  )}
                  {triageNotes[idea.id] && (
                    <div style={{ fontSize: 11, color: C.gold, marginBottom: 8, background: 'rgba(232,184,75,0.08)', border: `1px solid ${C.gold}`, borderRadius: 6, padding: '6px 8px' }}>
                      {triageNotes[idea.id]}
                    </div>
                  )}

                  {idea.ai_category && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, fontSize: 12, color: C.textMuted }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {badge(idea.ai_category, C.blue)}
                        {badge(`Time saved: ${idea.ai_time_saving}`, C.teal)}
                        {badge(`Revenue: ${idea.ai_revenue_potential}`, C.gold)}
                        {badge(`Confidence: ${idea.ai_confidence}`, C.textDim)}
                      </div>
                      {idea.ai_rationale && <div><b style={{ color: C.text }}>Why:</b> {idea.ai_rationale}</div>}
                      {idea.ai_recommended_action && <div><b style={{ color: C.text }}>Next step:</b> {idea.ai_recommended_action}</div>}
                      {idea.ai_research_needed && idea.ai_research_notes && (
                        <div><b style={{ color: C.text }}>Research needed:</b> {idea.ai_research_notes}</div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(needsTriage || idea.ai_triage_error) && (
                      <button onClick={() => triage(idea.id)} disabled={isTriaging} style={smallBtn('default', isTriaging)}>
                        {isTriaging ? 'Triaging…' : idea.ai_triage_error ? 'Retry triage' : 'Triage'}
                      </button>
                    )}
                    {(idea.status === 'new' || idea.status === 'triaged') && (
                      <>
                        <button onClick={() => setStatus(idea, 'approved')} style={smallBtn()}>Approve</button>
                        <button onClick={() => setStatus(idea, 'rejected')} style={smallBtn('danger')}>Reject</button>
                      </>
                    )}
                    {idea.status === 'approved' && (
                      <button onClick={() => setStatus(idea, 'in_progress')} style={smallBtn()}>Start</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
      {ideas.length === 0 && <div style={{ fontSize: 13, color: C.textDim, textAlign: 'center', padding: 40 }}>No ideas yet. Add one above.</div>}
    </main>
  )
}
