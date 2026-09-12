// Server-only. Fetches real engagement numbers for an already-published post from Instagram's
// own Graph API -- only ever called by an explicit "Load Stats"/"Refresh Stats" click in
// app/social/page.tsx. No automatic/background fetching anywhere.
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const GRAPH_VERSION = 'v25.0'
// Same host as publish/route.ts -- this app's access token is an Instagram API with Instagram
// Login token, which only works against graph.instagram.com, not graph.facebook.com.
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`

// The full field set this app wants. Not all of these are guaranteed available for every
// account/media combination (Meta's docs don't fully spell out permission requirements per
// field) -- if the full request errors, this falls back to the two fields that are reliably
// basic (like_count, comments_count) rather than failing the whole thing, and says plainly
// which fields it couldn't get.
const FULL_FIELDS = ['like_count', 'comments_count', 'saved_count', 'shares_count']
const FALLBACK_FIELDS = ['like_count', 'comments_count']

async function fetchFields(mediaId: string, accessToken: string, fields: string[]) {
  const url = `${GRAPH_BASE}/${mediaId}?fields=${fields.join(',')}&access_token=${encodeURIComponent(accessToken)}`
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok || data.error) {
    return { ok: false as const, error: data?.error?.message || `Meta returned ${res.status} fetching stats.` }
  }
  return { ok: true as const, data }
}

export async function POST(req: Request) {
  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Request body must be JSON with an `id` field.' }, { status: 400 })
  }
  const { id } = body
  if (!id) return Response.json({ error: 'Missing post id.' }, { status: 400 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError) return Response.json({ error: `Auth check failed: ${profileError.message}` }, { status: 500 })
  if (profile?.role !== 'coach') return Response.json({ error: 'Coach access only.' }, { status: 403 })

  const { data: row, error: rowError } = await supabase
    .from('social_posts').select('ig_media_id, status').eq('id', id).maybeSingle()
  if (rowError) return Response.json({ error: `Database error: ${rowError.message}` }, { status: 500 })
  if (!row) return Response.json({ error: 'No post found for this id.' }, { status: 404 })
  if (row.status !== 'published' || !row.ig_media_id) {
    return Response.json({ error: 'This post has not been published yet -- nothing to fetch stats for.' }, { status: 400 })
  }

  const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN
  if (!IG_ACCESS_TOKEN) {
    return Response.json({ error: 'IG_ACCESS_TOKEN is not configured on the server.' }, { status: 500 })
  }

  let result = await fetchFields(row.ig_media_id, IG_ACCESS_TOKEN, FULL_FIELDS)
  let unavailable: string[] = []
  if (!result.ok) {
    // Retry with just the reliably-basic fields rather than failing outright -- but keep the
    // original error visible so a real, ongoing permission problem doesn't look like success.
    const fallback = await fetchFields(row.ig_media_id, IG_ACCESS_TOKEN, FALLBACK_FIELDS)
    if (!fallback.ok) {
      return Response.json({ error: result.error }, { status: 502 })
    }
    result = fallback
    unavailable = FULL_FIELDS.filter(f => !FALLBACK_FIELDS.includes(f))
  }

  const stats = {
    like_count: result.data.like_count ?? null,
    comments_count: result.data.comments_count ?? null,
    saved_count: result.data.saved_count ?? null,
    shares_count: result.data.shares_count ?? null,
    unavailable,
    fetched_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabase.from('social_posts').update({ stats }).eq('id', id)
  if (updateError) {
    // Fetched successfully -- return it so it's not lost, but say plainly it wasn't cached.
    return Response.json({ stats, error: `Stats fetched but failed to save: ${updateError.message}` }, { status: 207 })
  }

  return Response.json({ stats })
}
