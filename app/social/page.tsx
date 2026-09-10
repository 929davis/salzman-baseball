'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CARD_TEXT_MAX_LENGTH } from '@/lib/social/card-template'

const C = {
  bg: '#0d1117', bg2: '#161b22', bg3: '#1c2333', border: '#30363d',
  gold: '#e8b84b', teal: '#39d353', red: '#f85149', blue: '#58a6ff',
  text: '#e6edf3', textMuted: '#7d8590', textDim: '#484f58',
}

const CAPTION_MAX = 2200

type Post = {
  id: string
  source_text: string
  caption: string | null
  status: 'draft' | 'published' | 'failed'
  ig_media_id: string | null
  permalink: string | null
  error: string | null
  created_at: string
  published_at: string | null
}

type ActionState =
  | { phase: 'idle' }
  | { phase: 'saving' }
  | { phase: 'generating' }
  | { phase: 'publishing' }
  | { phase: 'error', message: string }
  | { phase: 'ok', message: string }

const card = { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 16 }
const btn = (variant: 'gold' | 'default' | 'danger' = 'default', disabled = false) => ({
  background: disabled ? C.bg3 : variant === 'gold' ? C.gold : variant === 'danger' ? C.red : C.bg3,
  color: disabled ? C.textDim : variant === 'gold' || variant === 'danger' ? C.bg : C.text,
  border: `1px solid ${disabled ? C.border : variant === 'gold' ? C.gold : variant === 'danger' ? C.red : C.border}`,
  borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
})
const textarea = { width: '100%', minHeight: 120, background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, fontSize: 14, color: C.text, resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const }

function StatusBanner({ state }: { state: ActionState }) {
  if (state.phase === 'idle') return null
  const label: Record<string, string> = {
    saving: 'Saving draft...', generating: 'Drafting caption with Claude...', publishing: 'Publishing to Instagram — do not close this tab...',
  }
  if (state.phase === 'error') return <div style={{ background: 'rgba(248,81,73,0.1)', border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: C.red, fontSize: 13 }}>{state.message}</div>
  if (state.phase === 'ok') return <div style={{ background: 'rgba(57,211,83,0.1)', border: `1px solid ${C.teal}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: C.teal, fontSize: 13 }}>{state.message}</div>
  return <div style={{ background: 'rgba(232,184,75,0.08)', border: `1px solid ${C.gold}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: C.gold, fontSize: 13 }}>{label[state.phase]}</div>
}

export default function SocialPage() {
  const supabase = createClient()
  const router = useRouter()

  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [sourceText, setSourceText] = useState('')
  const [postId, setPostId] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [postStatus, setPostStatus] = useState<Post['status']>('draft')
  const [cardVersion, setCardVersion] = useState(0)
  const [action, setAction] = useState<ActionState>({ phase: 'idle' })
  const [recent, setRecent] = useState<Post[]>([])
  const [recentError, setRecentError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (profile?.role !== 'coach') { router.push('/pitcher'); return }
      setAuthorized(true)
    }
    init()
  }, [])

  const loadRecent = useCallback(async () => {
    const { data, error } = await supabase
      .from('social_posts').select('*').order('created_at', { ascending: false }).limit(10)
    if (error) {
      // A failed load must not look like "zero posts exist yet" -- that exact
      // look-alike-to-empty-state pattern is the #1 thing this feature should not repeat.
      setRecentError(`Could not load recent posts: ${error.message}`)
      return
    }
    setRecentError(null)
    setRecent(data || [])
  }, [])

  useEffect(() => { if (authorized) loadRecent() }, [authorized, loadRecent])

  const overLength = sourceText.length > CARD_TEXT_MAX_LENGTH

  const saveDraft = async () => {
    if (!sourceText.trim()) return
    setAction({ phase: 'saving' })
    if (postId) {
      const { error } = await supabase.from('social_posts').update({ source_text: sourceText }).eq('id', postId)
      if (error) { setAction({ phase: 'error', message: `Failed to save: ${error.message}` }); return }
    } else {
      const { data, error } = await supabase
        .from('social_posts').insert({ source_text: sourceText }).select().maybeSingle()
      if (error || !data) { setAction({ phase: 'error', message: `Failed to save: ${error?.message || 'no row returned'}` }); return }
      setPostId(data.id)
      setPostStatus(data.status)
    }
    setCardVersion(v => v + 1)
    setAction({ phase: 'ok', message: 'Draft saved.' })
    loadRecent()
  }

  const draftCaption = async () => {
    if (!postId) return
    setAction({ phase: 'generating' })
    try {
      const res = await fetch('/api/social/caption', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: postId }),
      })
      const data = await res.json()
      if (!res.ok) { setAction({ phase: 'error', message: data.error || `Caption generation failed (${res.status}).` }); return }
      setCaption(data.caption || '')
      setAction({ phase: data.error ? 'error' : 'ok', message: data.error || 'Caption drafted — edit it before publishing.' })
    } catch (err: any) {
      setAction({ phase: 'error', message: `Could not reach the caption API: ${err?.message || String(err)}` })
    }
  }

  const saveCaptionEdit = async (value: string) => {
    setCaption(value)
    if (postId) await supabase.from('social_posts').update({ caption: value }).eq('id', postId)
  }

  const publish = async () => {
    if (!postId || !caption.trim()) return
    if (!window.confirm('Publish this to Instagram now? This is irreversible.')) return
    setAction({ phase: 'publishing' })
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: postId }),
      })
      const data = await res.json()
      if (!res.ok) { setAction({ phase: 'error', message: data.error || `Publish failed (${res.status}).` }); loadRecent(); return }
      setPostStatus('published')
      setAction({ phase: 'ok', message: `Published${data.permalink ? ` — ${data.permalink}` : '.'}` })
      loadRecent()
    } catch (err: any) {
      setAction({ phase: 'error', message: `Could not reach the publish API: ${err?.message || String(err)}` })
    }
  }

  if (authorized === null) return <div style={{ minHeight: '100vh', background: C.bg, color: C.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui,-apple-system,sans-serif', padding: '32px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <button onClick={() => router.push('/coach')} style={{ background: 'transparent', border: 'none', color: C.textMuted, fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← Back to Coach Dashboard</button>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.gold, marginBottom: 4 }}>X → Instagram</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Paste something you posted on X, get a card and a drafted caption, edit, publish. Nothing posts without you clicking Publish.</div>

        <StatusBanner state={action} />

        <div style={card}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>1. Source text (from X)</div>
          <textarea style={textarea} value={sourceText} onChange={e => setSourceText(e.target.value)} placeholder="Paste the text of your X post here..." />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: overLength ? C.red : C.textDim }}>
              {sourceText.length} / {CARD_TEXT_MAX_LENGTH} characters{overLength ? ' — too long for a legible card, shorten it' : ''}
            </span>
            <button style={btn('gold', !sourceText.trim() || overLength)} disabled={!sourceText.trim() || overLength} onClick={saveDraft}>
              {postId ? 'Save & Regenerate Card' : 'Save Draft'}
            </button>
          </div>
        </div>

        {postId && (
          <div style={card}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>2. Card preview</div>
            <img
              key={cardVersion}
              src={`/api/social/card/${postId}?v=${cardVersion}`}
              alt="Instagram card preview"
              style={{ width: '100%', maxWidth: 400, borderRadius: 8, border: `1px solid ${C.border}`, display: 'block' }}
            />
          </div>
        )}

        {postId && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>3. Caption</div>
              <button style={btn('default', action.phase === 'generating')} disabled={action.phase === 'generating'} onClick={draftCaption}>
                {caption ? 'Redraft with Claude' : 'Draft Caption'}
              </button>
            </div>
            <textarea style={textarea} value={caption} onChange={e => saveCaptionEdit(e.target.value)} placeholder="Draft with the button above, or write your own — this is what gets published." />
            <div style={{ fontSize: 11, color: caption.length > CAPTION_MAX ? C.red : C.textDim, marginTop: 6 }}>
              {caption.length} / {CAPTION_MAX} characters
            </div>
          </div>
        )}

        {postId && (
          <div style={card}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 10 }}>4. Publish</div>
            {postStatus === 'published' ? (
              <div style={{ color: C.teal, fontSize: 13 }}>✓ Already published from this draft.</div>
            ) : (
              <button
                style={btn('danger', !caption.trim() || caption.length > CAPTION_MAX || action.phase === 'publishing')}
                disabled={!caption.trim() || caption.length > CAPTION_MAX || action.phase === 'publishing'}
                onClick={publish}
              >
                Publish to Instagram
              </button>
            )}
          </div>
        )}

        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 10, marginTop: 24 }}>Recent Posts</div>
        {recentError ? (
          <div style={{ color: C.red, fontSize: 12 }}>{recentError}</div>
        ) : recent.length === 0 ? (
          <div style={{ color: C.textDim, fontSize: 12 }}>No posts yet.</div>
        ) : (
          recent.map(p => (
            <div key={p.id} style={{ ...card, marginBottom: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, padding: '2px 8px', borderRadius: 10,
                  background: p.status === 'published' ? 'rgba(57,211,83,0.15)' : p.status === 'failed' ? 'rgba(248,81,73,0.15)' : 'rgba(125,133,144,0.15)',
                  color: p.status === 'published' ? C.teal : p.status === 'failed' ? C.red : C.textMuted,
                }}>{p.status}</span>
                <span style={{ fontSize: 11, color: C.textDim }}>{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize: 12, color: C.text, marginBottom: p.caption || p.error ? 6 : 0, lineHeight: 1.5 }}>{p.source_text.slice(0, 140)}{p.source_text.length > 140 ? '...' : ''}</div>
              {p.caption && <div style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic', marginBottom: 6 }}>{p.caption.slice(0, 140)}{p.caption.length > 140 ? '...' : ''}</div>}
              {p.error && <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>{p.error}</div>}
              {p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.blue }}>View on Instagram ↗</a>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
