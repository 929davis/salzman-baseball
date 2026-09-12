'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CARD_TEXT_MAX_LENGTH, THREAD_SEGMENT_MAX_LENGTH, THREAD_MIN_SEGMENTS, THREAD_MAX_SEGMENTS } from '@/lib/social/card-template'

const C = {
  bg: '#0d1117', bg2: '#161b22', bg3: '#1c2333', border: '#30363d',
  gold: '#e8b84b', teal: '#39d353', red: '#f85149', blue: '#58a6ff',
  text: '#e6edf3', textMuted: '#7d8590', textDim: '#484f58',
}

const CAPTION_MAX = 2200

type PostType = 'single' | 'thread' | 'photo'

type Stats = {
  like_count: number | null
  comments_count: number | null
  saved_count: number | null
  shares_count: number | null
  unavailable: string[]
  fetched_at: string
}

type Post = {
  id: string
  source_text: string
  caption: string | null
  status: 'draft' | 'published' | 'failed'
  post_type: PostType
  segments: string[] | null
  photo_urls: string[] | null
  ig_media_id: string | null
  permalink: string | null
  error: string | null
  stats: Stats | null
  created_at: string
  published_at: string | null
}

const PHOTOS_BUCKET = 'social-photos'
const MAX_PHOTOS = 10

type ActionState =
  | { phase: 'idle' }
  | { phase: 'saving' }
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
const smallBtn = (variant: 'default' | 'danger' = 'default', disabled = false) => ({
  background: 'transparent',
  color: disabled ? C.textDim : variant === 'danger' ? C.red : C.textMuted,
  border: `1px solid ${disabled ? C.border : variant === 'danger' ? C.red : C.border}`,
  borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
})
const textarea = { width: '100%', minHeight: 120, background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, fontSize: 14, color: C.text, resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const }
const segmentTextarea = { ...textarea, minHeight: 70 }

function StatusBanner({ state }: { state: ActionState }) {
  if (state.phase === 'idle') return null
  const label: Record<string, string> = {
    saving: 'Saving draft...', publishing: 'Publishing to Instagram — do not close this tab...',
  }
  if (state.phase === 'error') return <div style={{ background: 'rgba(248,81,73,0.1)', border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: C.red, fontSize: 13 }}>{state.message}</div>
  if (state.phase === 'ok') return <div style={{ background: 'rgba(57,211,83,0.1)', border: `1px solid ${C.teal}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: C.teal, fontSize: 13 }}>{state.message}</div>
  return <div style={{ background: 'rgba(232,184,75,0.08)', border: `1px solid ${C.gold}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: C.gold, fontSize: 13 }}>{label[state.phase]}</div>
}

const blankSegment = () => ''

export default function SocialPage() {
  const supabase = createClient()
  const router = useRouter()

  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [mode, setMode] = useState<PostType>('single')
  const [sourceText, setSourceText] = useState('')
  const [segments, setSegments] = useState<string[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [postId, setPostId] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [postStatus, setPostStatus] = useState<Post['status']>('draft')
  const [cardVersion, setCardVersion] = useState(0)
  const [action, setAction] = useState<ActionState>({ phase: 'idle' })
  const [recent, setRecent] = useState<Post[]>([])
  const [recentError, setRecentError] = useState<string | null>(null)
  const [statsLoading, setStatsLoading] = useState<string | null>(null)

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

  const resetComposer = () => {
    setPostId(null)
    setMode('single')
    setSourceText('')
    setSegments([])
    setPhotoUrls([])
    setCaption('')
    setPostStatus('draft')
    setCardVersion(0)
    setAction({ phase: 'idle' })
  }

  const loadIntoComposer = (p: Post) => {
    setPostId(p.id)
    setMode(p.post_type || 'single')
    setSourceText(p.source_text || '')
    setSegments(Array.isArray(p.segments) ? p.segments : [])
    setPhotoUrls(Array.isArray(p.photo_urls) ? p.photo_urls : [])
    setCaption(p.caption || '')
    setPostStatus(p.status)
    setCardVersion(v => v + 1)
    setAction({ phase: 'idle' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deletePost = async (p: Post) => {
    const warning = p.status === 'published'
      ? 'Delete this record? It has already been published to Instagram -- this only removes it from this tool, it does NOT delete the live Instagram post.'
      : 'Delete this draft? This cannot be undone.'
    if (!window.confirm(warning)) return
    const { error } = await supabase.from('social_posts').delete().eq('id', p.id)
    if (error) { setAction({ phase: 'error', message: `Failed to delete: ${error.message}` }); return }
    if (postId === p.id) resetComposer()
    loadRecent()
  }

  const overLength = sourceText.length > CARD_TEXT_MAX_LENGTH

  const saveDraft = async () => {
    if (!sourceText.trim()) return
    setAction({ phase: 'saving' })
    if (postId) {
      const { error } = await supabase.from('social_posts').update({ source_text: sourceText, post_type: mode }).eq('id', postId)
      if (error) { setAction({ phase: 'error', message: `Failed to save: ${error.message}` }); return }
    } else {
      const { data, error } = await supabase
        .from('social_posts').insert({ source_text: sourceText, post_type: mode }).select().maybeSingle()
      if (error || !data) { setAction({ phase: 'error', message: `Failed to save: ${error?.message || 'no row returned'}` }); return }
      setPostId(data.id)
      setPostStatus(data.status)
    }
    setCardVersion(v => v + 1)
    setAction({
      phase: 'ok',
      message: mode === 'thread' ? 'Label saved -- add the thread parts below.'
        : mode === 'photo' ? 'Label saved -- upload photos below.'
        : 'Draft saved.',
    })
    loadRecent()
  }

  const saveSegments = async () => {
    if (!postId) return
    setAction({ phase: 'saving' })
    const { error } = await supabase.from('social_posts').update({ segments, post_type: 'thread' }).eq('id', postId)
    if (error) { setAction({ phase: 'error', message: `Failed to save thread parts: ${error.message}` }); return }
    setCardVersion(v => v + 1)
    setAction({ phase: 'ok', message: 'Thread parts saved.' })
  }

  const updateSegment = (i: number, value: string) => {
    setSegments(segs => segs.map((s, idx) => idx === i ? value : s))
  }
  const removeSegment = (i: number) => {
    setSegments(segs => segs.filter((_, idx) => idx !== i))
  }
  const addSegment = () => {
    setSegments(segs => segs.length >= THREAD_MAX_SEGMENTS ? segs : [...segs, blankSegment()])
  }

  // Uploads go straight to Supabase Storage (public bucket -- Meta's crawler needs a real
  // public URL, same requirement as the generated card images) and persist immediately, no
  // separate "Save" click needed -- unlike thread parts, the upload itself is already the
  // explicit action.
  const uploadPhotos = async (files: FileList) => {
    if (!postId || files.length === 0) return
    if (photoUrls.length + files.length > MAX_PHOTOS) {
      setAction({ phase: 'error', message: `That would be ${photoUrls.length + files.length} photos -- Instagram carousels max out at ${MAX_PHOTOS}.` })
      return
    }
    setUploading(true)
    setAction({ phase: 'saving' })
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      const path = `${postId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, file)
      if (uploadError) {
        setUploading(false)
        setAction({ phase: 'error', message: `Failed to upload ${file.name}: ${uploadError.message}` })
        return
      }
      const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
      newUrls.push(data.publicUrl)
    }
    const updated = [...photoUrls, ...newUrls]
    const { error } = await supabase.from('social_posts').update({ photo_urls: updated, post_type: 'photo' }).eq('id', postId)
    setUploading(false)
    if (error) { setAction({ phase: 'error', message: `Uploaded but failed to save: ${error.message}` }); return }
    setPhotoUrls(updated)
    setAction({ phase: 'ok', message: `${newUrls.length} photo${newUrls.length === 1 ? '' : 's'} uploaded.` })
  }

  // Only detaches the photo from this post -- doesn't delete the underlying file from
  // storage, in case it's still referenced elsewhere or the coach wants it back. Leftover
  // storage files are harmless clutter, not a correctness problem.
  const removePhoto = async (i: number) => {
    const updated = photoUrls.filter((_, idx) => idx !== i)
    setPhotoUrls(updated)
    if (postId) {
      const { error } = await supabase.from('social_posts').update({ photo_urls: updated }).eq('id', postId)
      if (error) setAction({ phase: 'error', message: `Failed to save removal: ${error.message}` })
    }
  }

  const saveCaptionEdit = async (value: string) => {
    setCaption(value)
    if (postId) await supabase.from('social_posts').update({ caption: value }).eq('id', postId)
  }

  const loadStats = async (id: string) => {
    setStatsLoading(id)
    try {
      const res = await fetch('/api/social/stats', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) { setAction({ phase: 'error', message: data.error || `Stats fetch failed (${res.status}).` }); setStatsLoading(null); return }
      setRecent(list => list.map(p => p.id === id ? { ...p, stats: data.stats } : p))
      if (data.error) setAction({ phase: 'error', message: data.error })
    } catch (err: any) {
      setAction({ phase: 'error', message: `Could not reach the stats API: ${err?.message || String(err)}` })
    }
    setStatsLoading(null)
  }

  const publish = async () => {
    if (!postId || !caption.trim()) return
    const confirmMsg = mode === 'thread'
      ? `Publish this ${segments.length}-slide carousel to Instagram now? This is irreversible.`
      : mode === 'photo' && photoUrls.length > 1
      ? `Publish this ${photoUrls.length}-photo carousel to Instagram now? This is irreversible.`
      : 'Publish this to Instagram now? This is irreversible.'
    if (!window.confirm(confirmMsg)) return
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

  const threadValid = segments.length >= THREAD_MIN_SEGMENTS && segments.length <= THREAD_MAX_SEGMENTS
    && segments.every(s => s.trim() && s.length <= THREAD_SEGMENT_MAX_LENGTH)
  const photoValid = photoUrls.length >= 1 && photoUrls.length <= MAX_PHOTOS
  const readyForCaption = mode === 'single' || (mode === 'thread' && threadValid) || (mode === 'photo' && photoValid)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui,-apple-system,sans-serif', padding: '32px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => router.push('/coach')} style={{ background: 'transparent', border: 'none', color: C.textMuted, fontSize: 12, cursor: 'pointer', padding: 0 }}>← Back to Coach Dashboard</button>
          <button onClick={resetComposer} style={smallBtn()}>+ New Post</button>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.gold, marginBottom: 4 }}>X → Instagram</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Paste something you posted on X, get a matching card, write your caption, and publish. Or write out a thread and publish it as a carousel. Nothing posts without you clicking Publish.</div>

        <StatusBanner state={action} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            style={{ ...btn(mode === 'single' ? 'gold' : 'default'), flex: 1 }}
            onClick={() => setMode('single')}
          >
            Single Post
          </button>
          <button
            style={{ ...btn(mode === 'thread' ? 'gold' : 'default'), flex: 1 }}
            onClick={() => setMode('thread')}
          >
            Thread → Carousel
          </button>
          <button
            style={{ ...btn(mode === 'photo' ? 'gold' : 'default'), flex: 1 }}
            onClick={() => setMode('photo')}
          >
            Photo Post
          </button>
        </div>

        <div style={card}>
          <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>
            1. {mode === 'thread' ? 'Thread label (for your own reference)' : mode === 'photo' ? 'Photo post label (for your own reference)' : 'Source text (from X)'}
          </div>
          <textarea
            style={textarea}
            value={sourceText}
            onChange={e => setSourceText(e.target.value)}
            placeholder={
              mode === 'thread' ? "A short description of what this thread is about -- shown in the Recent Posts list below so you can find it later. Doesn't get posted anywhere itself."
              : mode === 'photo' ? "A short description of this post -- shown in the Recent Posts list below so you can find it later. Doesn't get posted anywhere itself."
              : 'Paste the text of your X post here...'
            }
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: mode === 'single' && overLength ? C.red : C.textDim }}>
              {mode === 'single'
                ? `${sourceText.length} / ${CARD_TEXT_MAX_LENGTH} characters${overLength ? ' — too long for a legible card, shorten it' : ''}`
                : `${sourceText.length} characters`}
            </span>
            <button style={btn('gold', !sourceText.trim() || (mode === 'single' && overLength))} disabled={!sourceText.trim() || (mode === 'single' && overLength)} onClick={saveDraft}>
              {postId ? 'Save' : 'Save Draft'}
            </button>
          </div>
        </div>

        {postId && mode === 'thread' && (
          <div style={card}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 10 }}>2. Thread parts</div>

            {segments.length === 0 ? (
              <div style={{ fontSize: 12, color: C.textDim }}>No parts yet — add each part of the thread below (one per carousel slide).</div>
            ) : (
              segments.map((seg, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Slide {i + 1}</span>
                    <button style={smallBtn('danger')} onClick={() => removeSegment(i)}>Remove</button>
                  </div>
                  <textarea style={segmentTextarea} value={seg} onChange={e => updateSegment(i, e.target.value)} />
                  <div style={{ fontSize: 11, color: seg.length > THREAD_SEGMENT_MAX_LENGTH ? C.red : C.textDim, marginTop: 2 }}>
                    {seg.length} / {THREAD_SEGMENT_MAX_LENGTH} characters
                  </div>
                </div>
              ))
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <button style={smallBtn('default', segments.length >= THREAD_MAX_SEGMENTS)} disabled={segments.length >= THREAD_MAX_SEGMENTS} onClick={addSegment}>+ Add Part</button>
              <button style={btn('gold', !threadValid)} disabled={!threadValid} onClick={saveSegments}>Save Thread Parts</button>
            </div>
            {!threadValid && segments.length > 0 && (
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>
                Needs {THREAD_MIN_SEGMENTS}–{THREAD_MAX_SEGMENTS} non-empty parts, each under {THREAD_SEGMENT_MAX_LENGTH} characters, before saving.
              </div>
            )}
          </div>
        )}

        {postId && mode === 'photo' && (
          <div style={card}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 10 }}>2. Photo(s)</div>

            {photoUrls.length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 10 }}>
                {photoUrls.map((url, i) => (
                  <div key={url} style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={url} alt={`Photo ${i + 1}`} style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}`, display: 'block' }} />
                    <button
                      onClick={() => removePhoto(i)}
                      style={{ position: 'absolute', top: 4, right: 4, background: C.bg, border: `1px solid ${C.border}`, color: C.red, borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '2px 6px', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading || photoUrls.length >= MAX_PHOTOS}
              onChange={e => { if (e.target.files) uploadPhotos(e.target.files); e.target.value = '' }}
              style={{ fontSize: 12, color: C.textMuted }}
            />
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>
              {photoUrls.length} / {MAX_PHOTOS} photos. 1 photo posts as a single image; 2+ post as a carousel.
            </div>
          </div>
        )}

        {postId && mode !== 'photo' && (mode === 'single' || threadValid) && (
          <div style={card}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>
              {mode === 'thread' ? '3. Carousel preview' : '2. Card preview'}
            </div>
            {mode === 'thread' ? (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {segments.map((_, i) => (
                  <img
                    key={`${cardVersion}-${i}`}
                    src={`/api/social/card/${postId}?slide=${i}&v=${cardVersion}`}
                    alt={`Slide ${i + 1}`}
                    style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }}
                  />
                ))}
              </div>
            ) : (
              <img
                key={cardVersion}
                src={`/api/social/card/${postId}?v=${cardVersion}`}
                alt="Instagram card preview"
                style={{ width: '100%', maxWidth: 400, borderRadius: 8, border: `1px solid ${C.border}`, display: 'block' }}
              />
            )}
          </div>
        )}

        {postId && readyForCaption && (
          <div style={card}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>
              {mode === 'thread' ? '4. Caption (whole carousel)' : '3. Caption'}
            </div>
            <textarea style={textarea} value={caption} onChange={e => saveCaptionEdit(e.target.value)} placeholder="Write the caption that gets published with this post." />
            <div style={{ fontSize: 11, color: caption.length > CAPTION_MAX ? C.red : C.textDim, marginTop: 6 }}>
              {caption.length} / {CAPTION_MAX} characters
            </div>
          </div>
        )}

        {postId && readyForCaption && (
          <div style={card}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 10 }}>
              {mode === 'thread' ? '5. Publish' : '4. Publish'}
            </div>
            {postStatus === 'published' ? (
              <div style={{ color: C.teal, fontSize: 13 }}>✓ Already published from this draft.</div>
            ) : (
              <button
                style={btn('danger', !caption.trim() || caption.length > CAPTION_MAX || action.phase === 'publishing')}
                disabled={!caption.trim() || caption.length > CAPTION_MAX || action.phase === 'publishing'}
                onClick={publish}
              >
                {mode === 'thread' || (mode === 'photo' && photoUrls.length > 1) ? 'Publish Carousel to Instagram' : 'Publish to Instagram'}
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
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, padding: '2px 8px', borderRadius: 10,
                    background: p.status === 'published' ? 'rgba(57,211,83,0.15)' : p.status === 'failed' ? 'rgba(248,81,73,0.15)' : 'rgba(125,133,144,0.15)',
                    color: p.status === 'published' ? C.teal : p.status === 'failed' ? C.red : C.textMuted,
                  }}>{p.status}</span>
                  {p.post_type === 'thread' && (
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, padding: '2px 8px', borderRadius: 10, background: 'rgba(232,184,75,0.12)', color: C.gold }}>
                      thread · {Array.isArray(p.segments) ? p.segments.length : 0} slides
                    </span>
                  )}
                  {p.post_type === 'photo' && (
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, padding: '2px 8px', borderRadius: 10, background: 'rgba(88,166,255,0.12)', color: C.blue }}>
                      photo · {Array.isArray(p.photo_urls) ? p.photo_urls.length : 0}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: C.textDim }}>{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize: 12, color: C.text, marginBottom: p.caption || p.error ? 6 : 0, lineHeight: 1.5 }}>{p.source_text.slice(0, 140)}{p.source_text.length > 140 ? '...' : ''}</div>
              {p.caption && <div style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic', marginBottom: 6 }}>{p.caption.slice(0, 140)}{p.caption.length > 140 ? '...' : ''}</div>}
              {p.error && <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>{p.error}</div>}
              {p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.blue, display: 'block', marginBottom: 6 }}>View on Instagram ↗</a>}

              {p.status === 'published' && (
                <div style={{ marginBottom: 6 }}>
                  {p.stats ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 12, color: C.text }}>
                        ❤️ {p.stats.like_count ?? '—'} · 💬 {p.stats.comments_count ?? '—'}
                        {p.stats.saved_count != null && ` · 🔖 ${p.stats.saved_count}`}
                        {p.stats.shares_count != null && ` · ↗ ${p.stats.shares_count}`}
                      </span>
                      <span style={{ fontSize: 10, color: C.textDim }}>as of {new Date(p.stats.fetched_at).toLocaleString()}</span>
                      <button style={smallBtn('default', statsLoading === p.id)} disabled={statsLoading === p.id} onClick={() => loadStats(p.id)}>
                        {statsLoading === p.id ? 'Refreshing...' : 'Refresh'}
                      </button>
                      {p.stats.unavailable.length > 0 && (
                        <span style={{ fontSize: 10, color: C.textDim, width: '100%' }}>
                          Couldn't get: {p.stats.unavailable.join(', ')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <button style={smallBtn('default', statsLoading === p.id)} disabled={statsLoading === p.id} onClick={() => loadStats(p.id)}>
                      {statsLoading === p.id ? 'Loading...' : 'Load Stats'}
                    </button>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button style={smallBtn()} onClick={() => loadIntoComposer(p)}>Edit</button>
                <button style={smallBtn('danger')} onClick={() => deletePost(p)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
