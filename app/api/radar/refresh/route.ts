// Server-only. YOUTUBE_API_KEY never reaches the browser. Only ever called by an explicit
// click on "Refresh" in app/social/radar/page.tsx -- there is no cron/scheduled path.
//
// Quota model (confirmed against Google's own docs, current as of 2026): search.list has its
// own separate daily bucket, 100 calls/day by default -- NOT part of the general 10,000-unit
// pool. commentThreads.list, channels.list, and playlistItems.list all draw from the general
// pool at 1 unit/call. Two independent caps are tracked and enforced below for exactly that
// reason. Channel sources deliberately use channels.list + playlistItems.list, not
// search.list, specifically to avoid spending the scarce 100/day search bucket on uploads
// that don't need a search at all.
//
// 30-day retention: this route purges radar_items older than 30 days as its first step, every
// run -- see sql/question_radar.sql's header for why (YouTube API Services Terms data
// retention requirement, and there is no cron to do this on a schedule instead).
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3'
const SEARCH_CALL_DAILY_CAP = 90   // of a 100/day bucket -- leaves headroom for a manual retry
const GENERAL_UNIT_DAILY_CAP = 8000 // of a 10,000/day bucket, per the stated v1 requirement
const RETENTION_DAYS = 30

function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.includes('?')) return true
  return /^(how|why|what|should|can|does|is)\b/.test(t)
}

// Strips HTML the YouTube API returns in comment/description text (e.g. <br>, <a href=...>)
// down to plain text -- this is stored and later pasted into a claude.ai prompt, where raw
// HTML would just be noise.
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
}

async function ytFetch(path: string, params: Record<string, string>, apiKey: string): Promise<{ ok: true, data: any } | { ok: false, error: string }> {
  const url = `${YOUTUBE_BASE}/${path}?${new URLSearchParams({ ...params, key: apiKey })}`
  let res: Response
  try {
    res = await fetch(url)
  } catch (err: any) {
    return { ok: false, error: `Could not reach YouTube API (${path}): ${err?.message || String(err)}` }
  }
  const data = await res.json()
  if (!res.ok || data.error) {
    return { ok: false, error: data?.error?.message || `YouTube API returned ${res.status} on ${path}.` }
  }
  return { ok: true, data }
}

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError) return Response.json({ error: `Auth check failed: ${profileError.message}` }, { status: 500 })
  if (profile?.role !== 'coach') return Response.json({ error: 'Coach access only.' }, { status: 403 })

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
  if (!YOUTUBE_API_KEY) {
    return Response.json({ error: 'YOUTUBE_API_KEY is not configured on the server.' }, { status: 500 })
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error: purgeError } = await supabase.from('radar_items').delete().lt('fetched_at', cutoff)
  if (purgeError) return Response.json({ error: `Retention purge failed: ${purgeError.message}` }, { status: 500 })

  const today = new Date().toISOString().split('T')[0]
  const { data: usageRow } = await supabase.from('radar_api_usage').select('*').eq('date', today).maybeSingle()
  let unitsUsed = usageRow?.youtube_units_used ?? 0
  let searchCallsUsed = usageRow?.youtube_search_calls_used ?? 0

  const { data: sources, error: sourcesError } = await supabase.from('radar_sources').select('*').eq('active', true)
  if (sourcesError) return Response.json({ error: `Could not load sources: ${sourcesError.message}` }, { status: 500 })

  const itemsToUpsert: any[] = []
  const skippedSources: string[] = []
  const errors: string[] = []

  for (const source of sources || []) {
    if (source.type === 'youtube_query') {
      if (searchCallsUsed >= SEARCH_CALL_DAILY_CAP) {
        skippedSources.push(`${source.value} (youtube_query): search-call daily cap reached`)
        continue
      }
      const searchRes = await ytFetch('search', { part: 'snippet', q: source.value, type: 'video', order: 'relevance', maxResults: '10' }, YOUTUBE_API_KEY)
      searchCallsUsed += 1
      if (!searchRes.ok) { errors.push(`${source.value}: ${searchRes.error}`); continue }
      for (const item of searchRes.data.items || []) {
        const videoId = item.id?.videoId
        const videoTitle = stripHtml(item.snippet?.title || '')
        if (!videoId) continue
        if (unitsUsed >= GENERAL_UNIT_DAILY_CAP) { skippedSources.push(`${source.value}: general unit cap reached mid-run`); break }
        const commentsRes = await ytFetch('commentThreads', { part: 'snippet', videoId, order: 'relevance', maxResults: '50', textFormat: 'plainText' }, YOUTUBE_API_KEY)
        unitsUsed += 1
        if (!commentsRes.ok) { errors.push(`${videoTitle}: ${commentsRes.error}`); continue }
        for (const thread of commentsRes.data.items || []) {
          const snippet = thread.snippet?.topLevelComment?.snippet
          if (!snippet) continue
          const text = stripHtml(snippet.textDisplay || '')
          if (!looksLikeQuestion(text)) continue
          const commentId = thread.snippet?.topLevelComment?.id
          itemsToUpsert.push({
            source_id: source.id,
            source_url: `https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`,
            text, kind: 'question',
            engagement_count: snippet.likeCount ?? 0,
            video_or_post_title: videoTitle,
            fetched_at: new Date().toISOString(),
          })
        }
      }
    } else if (source.type === 'youtube_channel') {
      if (unitsUsed >= GENERAL_UNIT_DAILY_CAP) { skippedSources.push(`${source.value} (youtube_channel): general unit cap reached`); continue }
      const channelRes = await ytFetch('channels', { part: 'contentDetails', id: source.value }, YOUTUBE_API_KEY)
      unitsUsed += 1
      if (!channelRes.ok) { errors.push(`${source.value}: ${channelRes.error}`); continue }
      const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
      if (!uploadsPlaylistId) { errors.push(`${source.value}: no uploads playlist found (bad channel id?)`); continue }
      if (unitsUsed >= GENERAL_UNIT_DAILY_CAP) { skippedSources.push(`${source.value}: general unit cap reached`); continue }
      const uploadsRes = await ytFetch('playlistItems', { part: 'snippet', playlistId: uploadsPlaylistId, maxResults: '10' }, YOUTUBE_API_KEY)
      unitsUsed += 1
      if (!uploadsRes.ok) { errors.push(`${source.value}: ${uploadsRes.error}`); continue }
      for (const item of uploadsRes.data.items || []) {
        const videoId = item.snippet?.resourceId?.videoId
        if (!videoId) continue
        const title = stripHtml(item.snippet?.title || '')
        const description = stripHtml(item.snippet?.description || '')
        itemsToUpsert.push({
          source_id: source.id,
          source_url: `https://www.youtube.com/watch?v=${videoId}`,
          text: description ? `${title}\n\n${description}` : title,
          kind: 'claim',
          engagement_count: null,
          video_or_post_title: title,
          fetched_at: new Date().toISOString(),
        })
      }
    } else if (source.type === 'subreddit') {
      // v1: guarded, not implemented. No REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET exist in this
      // app's env today -- when they do, this branch needs a real implementation (Reddit's
      // own OAuth2 + API terms need their own pass first, per the plan this was built from).
      if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
        skippedSources.push(`${source.value} (subreddit): not connected`)
      } else {
        skippedSources.push(`${source.value} (subreddit): credentials present but Reddit fetching isn't implemented yet`)
      }
    }
  }

  if (itemsToUpsert.length > 0) {
    const { error: upsertError } = await supabase.from('radar_items')
      .upsert(itemsToUpsert, { onConflict: 'source_url', ignoreDuplicates: true })
    if (upsertError) errors.push(`Saving items failed: ${upsertError.message}`)
  }

  await supabase.from('radar_api_usage').upsert({
    date: today, youtube_units_used: unitsUsed, youtube_search_calls_used: searchCallsUsed,
  }, { onConflict: 'date' })

  return Response.json({
    itemsAdded: itemsToUpsert.length,
    unitsUsed, searchCallsUsed,
    unitsCap: GENERAL_UNIT_DAILY_CAP, searchCallsCap: SEARCH_CALL_DAILY_CAP,
    skippedSources, errors,
  })
}
