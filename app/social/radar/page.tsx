'use client'
// Question Radar (v1). Coach-only research queue: a manual refresh button pulls candidate
// content questions from YouTube (see app/api/radar/refresh/route.ts for the quota/retention
// rules that govern it) into radar_items, which get clustered via a manual copy-prompt /
// paste-back round trip through claude.ai -- no in-app Claude API call anywhere in this page.
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const C = {
  bg: '#0d1117', bg2: '#161b22', bg3: '#1c2333', border: '#30363d',
  gold: '#e8b84b', teal: '#39d353', red: '#f85149',
  text: '#e6edf3', textMuted: '#7d8590', textDim: '#484f58',
}

type SourceType = 'youtube_query' | 'youtube_channel' | 'subreddit'
type RadarSource = { id: string, type: SourceType, value: string, active: boolean }
type RadarItem = {
  id: string, source_id: string, source_url: string, text: string,
  kind: 'question' | 'claim', engagement_count: number | null,
  video_or_post_title: string | null, fetched_at: string, cluster_label: string | null, status: string,
}
type RefreshResult = {
  itemsAdded: number, unitsUsed: number, searchCallsUsed: number,
  unitsCap: number, searchCallsCap: number, skippedSources: string[], errors: string[],
}

const btn = (variant: 'gold' | 'default' = 'default'): React.CSSProperties => ({
  background: variant === 'gold' ? C.gold : C.bg3,
  color: variant === 'gold' ? C.bg : C.text,
  border: `1px solid ${variant === 'gold' ? C.gold : C.border}`,
  borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: variant === 'gold' ? 700 : 500,
  cursor: 'pointer',
})
const input: React.CSSProperties = {
  background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px',
  fontSize: 13, color: C.text, outline: 'none',
}
const card: React.CSSProperties = { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 12 }

export default function QuestionRadarPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<RadarSource[]>([])
  const [items, setItems] = useState<RadarItem[]>([])
  const [newSource, setNewSource] = useState<{ type: SourceType, value: string }>({ type: 'youtube_query', value: '' })
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<RefreshResult | { error: string } | null>(null)

  // The exact set of {index, item} pairs most recently copied into a cluster prompt -- paste-back
  // matches Claude's returned "N: label" lines against THIS array by index, not by re-fetching or
  // fuzzy-matching item text. Cleared/replaced every time "Copy cluster prompt" runs again.
  const [promptedItems, setPromptedItems] = useState<RadarItem[]>([])
  const [pasteBack, setPasteBack] = useState('')
  const [pasteBackResult, setPasteBackResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [srcRes, itemRes] = await Promise.all([
      supabase.from('radar_sources').select('*').order('created_at', { ascending: false }),
      supabase.from('radar_items').select('*').order('fetched_at', { ascending: false }),
    ])
    setSources(srcRes.data || [])
    setItems(itemRes.data || [])
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

  const addSource = async () => {
    if (!newSource.value.trim()) return
    await supabase.from('radar_sources').insert({ type: newSource.type, value: newSource.value.trim(), active: true })
    setNewSource({ type: 'youtube_query', value: '' })
    await load()
  }

  const toggleSource = async (s: RadarSource) => {
    await supabase.from('radar_sources').update({ active: !s.active }).eq('id', s.id)
    await load()
  }

  const refresh = async () => {
    setRefreshing(true)
    setRefreshResult(null)
    try {
      const res = await fetch('/api/radar/refresh', { method: 'POST' })
      const data = await res.json()
      setRefreshResult(res.ok ? data : { error: data.error || 'Refresh failed.' })
      if (res.ok) await load()
    } catch (err: any) {
      setRefreshResult({ error: err?.message || 'Refresh failed.' })
    }
    setRefreshing(false)
  }

  const sendToIdeas = async (item: RadarItem) => {
    await supabase.from('radar_ideas').insert({ radar_item_id: item.id, text: item.text, source: 'question_radar' })
    await supabase.from('radar_items').update({ status: 'sent_to_ideas' }).eq('id', item.id)
    await load()
  }

  const copyClusterPrompt = async () => {
    const unclustered = items.filter(i => !i.cluster_label).slice(0, 200)
    setPromptedItems(unclustered)
    setPasteBackResult(null)
    const list = unclustered.map((it, i) => `${i + 1}. ${it.text.replace(/\n/g, ' ')}`).join('\n')
    const prompt = `Below is a numbered list of questions/claims pulled from pitching-content comments and uploads. Group them into a small number of topic clusters (aim for 5-15 clusters covering the recurring themes, not one per item).

Return your answer as one line per item, in this exact format, nothing else:
N: Cluster Name

Where N is the item's number below. Use the same Cluster Name text for every item in the same cluster.

${list}`
    await navigator.clipboard.writeText(prompt).catch(() => {})
    window.open('https://claude.ai', '_blank')
  }

  const applyPasteBack = async () => {
    const lines = pasteBack.split('\n').map(l => l.trim()).filter(Boolean)
    const updates: { id: string, cluster_label: string }[] = []
    for (const line of lines) {
      const m = line.match(/^(\d+)\s*:\s*(.+)$/)
      if (!m) continue
      const idx = parseInt(m[1], 10) - 1
      const label = m[2].trim()
      const item = promptedItems[idx]
      if (item) updates.push({ id: item.id, cluster_label: label })
    }
    if (updates.length === 0) {
      setPasteBackResult('Could not parse any lines -- expected "N: Cluster Name" format.')
      return
    }
    for (const u of updates) {
      await supabase.from('radar_items').update({ cluster_label: u.cluster_label }).eq('id', u.id)
    }
    setPasteBackResult(`Applied cluster labels to ${updates.length} of ${promptedItems.length} item(s).`)
    setPasteBack('')
    await load()
  }

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontFamily: 'system-ui' }}>Loading...</div>

  const grouped = new Map<string, RadarItem[]>()
  for (const item of items) {
    const key = item.cluster_label || 'Unclustered'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(item)
  }
  const unclusteredCount = items.filter(i => !i.cluster_label).length

  return (
    <main style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, sans-serif', padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>Question Radar</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{items.length} item(s), {unclusteredCount} unclustered</div>
        </div>
        <button onClick={() => router.push('/social')} style={btn()}>← Back to Composer</button>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Sources</div>
        {sources.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', width: 110 }}>{s.type.replace('_', ' ')}</span>
            <span style={{ fontSize: 13, flex: 1 }}>{s.value}</span>
            <label style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={s.active} onChange={() => toggleSource(s)} /> active
            </label>
          </div>
        ))}
        {sources.length === 0 && <div style={{ fontSize: 12, color: C.textDim, padding: '6px 0' }}>No sources yet.</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <select value={newSource.type} onChange={e => setNewSource(s => ({ ...s, type: e.target.value as SourceType }))} style={input}>
            <option value="youtube_query">YouTube query</option>
            <option value="youtube_channel">YouTube channel (ID)</option>
            <option value="subreddit">Subreddit</option>
          </select>
          <input style={{ ...input, flex: 1 }} placeholder="value" value={newSource.value} onChange={e => setNewSource(s => ({ ...s, value: e.target.value }))} />
          <button onClick={addSource} style={btn('gold')}>Add</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={refresh} disabled={refreshing} style={btn('gold')}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          {refreshResult && 'error' in refreshResult && <span style={{ fontSize: 12, color: C.red }}>{refreshResult.error}</span>}
          {refreshResult && 'itemsAdded' in refreshResult && (
            <span style={{ fontSize: 12, color: C.textMuted }}>
              +{refreshResult.itemsAdded} item(s) · {refreshResult.searchCallsUsed}/{refreshResult.searchCallsCap} search calls · {refreshResult.unitsUsed}/{refreshResult.unitsCap} units today
            </span>
          )}
        </div>
        {refreshResult && 'skippedSources' in refreshResult && refreshResult.skippedSources.length > 0 && (
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>Skipped: {refreshResult.skippedSources.join('; ')}</div>
        )}
        {refreshResult && 'errors' in refreshResult && refreshResult.errors.length > 0 && (
          <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>{refreshResult.errors.join('; ')}</div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={copyClusterPrompt} style={btn()}>Copy cluster prompt ({Math.min(unclusteredCount, 200)} items)</button>
        </div>
        <textarea
          value={pasteBack} onChange={e => setPasteBack(e.target.value)}
          placeholder="Paste Claude's response here (N: Cluster Name, one per line)"
          style={{ ...input, width: '100%', minHeight: 80, fontFamily: 'monospace', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <button onClick={applyPasteBack} style={btn('gold')}>Apply labels</button>
          {pasteBackResult && <span style={{ fontSize: 12, color: C.textMuted }}>{pasteBackResult}</span>}
        </div>
      </div>

      {Array.from(grouped.entries()).map(([label, groupItems]) => (
        <div key={label} style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: label === 'Unclustered' ? C.textMuted : C.gold, marginBottom: 8 }}>
            {label} ({groupItems.length})
          </div>
          {groupItems.map(item => (
            <div key={item.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13 }}>{item.text}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase' }}>{item.kind}</span>
                {item.engagement_count != null && <span style={{ fontSize: 11, color: C.textDim }}>{item.engagement_count} likes</span>}
                <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.textMuted }}>source</a>
                <span style={{ flex: 1 }} />
                {item.status === 'sent_to_ideas'
                  ? <span style={{ fontSize: 11, color: C.teal }}>Sent to ideas</span>
                  : <button onClick={() => sendToIdeas(item)} style={{ ...btn(), padding: '3px 10px', fontSize: 11 }}>Send to ideas</button>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {items.length === 0 && <div style={{ fontSize: 13, color: C.textDim, textAlign: 'center', padding: 40 }}>No items yet. Add a source and hit Refresh.</div>}
    </main>
  )
}
