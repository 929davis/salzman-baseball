// Server-only. IG_ACCESS_TOKEN never reaches the browser. Only ever called by an explicit
// click on "Publish to Instagram" in app/social/page.tsx -- there is no auto-post path
// anywhere in this feature.
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const GRAPH_VERSION = 'v25.0' // verified against Meta's current Content Publishing docs
// Using graph.instagram.com, not graph.facebook.com: the access token this app generates
// (via the Instagram Business use case's Tester token tool) is an "Instagram API with
// Instagram Login" token, not a Facebook Login token -- it only works against this host.
// Endpoint paths and params are identical between the two flows, only the host differs.
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`

async function pollContainerStatus(containerId: string, accessToken: string): Promise<{ ok: true } | { ok: false, error: string }> {
  // Images are usually ready immediately, but a short retry costs nothing and closes a real
  // race: publishing a container before Meta has finished processing it.
  const delays = [0, 1000, 2000, 3000, 5000]
  for (const delay of delays) {
    if (delay) await new Promise(r => setTimeout(r, delay))
    const url = `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
    let res: Response
    try {
      res = await fetch(url)
    } catch (err: any) {
      return { ok: false, error: `Could not reach Meta Graph API while checking container status: ${err?.message || String(err)}` }
    }
    const data = await res.json()
    if (!res.ok || data.error) {
      return { ok: false, error: data?.error?.message || `Meta returned ${res.status} checking container status.` }
    }
    if (data.status_code === 'FINISHED') return { ok: true }
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      return { ok: false, error: `Container status: ${data.status_code}` }
    }
    // IN_PROGRESS -- keep polling
  }
  return { ok: false, error: 'Container never reached FINISHED after 5 status checks -- Meta may still be processing it.' }
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
    .from('social_posts').select('*').eq('id', id).maybeSingle()
  if (rowError) return Response.json({ error: `Database error: ${rowError.message}` }, { status: 500 })
  if (!row) return Response.json({ error: 'No post found for this id.' }, { status: 404 })

  if (row.status === 'published') {
    return Response.json({ error: 'This post has already been published. Refusing to post it again.' }, { status: 409 })
  }
  if (!row.caption || !row.caption.trim()) {
    return Response.json({ error: 'This post has no caption yet.' }, { status: 400 })
  }

  const IG_USER_ID = process.env.IG_USER_ID
  const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  if (!IG_USER_ID || !IG_ACCESS_TOKEN || !SITE_URL) {
    return Response.json({ error: 'IG_USER_ID, IG_ACCESS_TOKEN, or NEXT_PUBLIC_SITE_URL is not configured on the server.' }, { status: 500 })
  }

  const imageUrl = `${SITE_URL}/api/social/card/${id}`

  async function fail(message: string) {
    await supabase.from('social_posts').update({ status: 'failed', error: message }).eq('id', id)
    return Response.json({ error: message }, { status: 502 })
  }

  // Step 1: create the media container. URLSearchParams handles encoding image_url and the
  // caption (which may contain newlines, apostrophes, and a literal `#` -- Meta's container
  // call fails if `#` isn't percent-encoded, and URLSearchParams does this correctly).
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption: row.caption,
    access_token: IG_ACCESS_TOKEN,
  })

  let containerRes: Response
  try {
    containerRes = await fetch(`${GRAPH_BASE}/${IG_USER_ID}/media`, {
      method: 'POST',
      body: containerParams,
    })
  } catch (err: any) {
    return fail(`Could not reach Meta Graph API creating the media container: ${err?.message || String(err)}`)
  }
  const containerData = await containerRes.json()
  if (!containerRes.ok || containerData.error) {
    return fail(containerData?.error?.message || `Meta returned ${containerRes.status} creating the media container.`)
  }
  const containerId = containerData.id
  if (!containerId) return fail('Meta did not return a container id.')

  // Step 2: confirm the container finished processing before publishing it.
  const status = await pollContainerStatus(containerId, IG_ACCESS_TOKEN)
  if (!status.ok) return fail(status.error)

  // Step 3: publish.
  const publishParams = new URLSearchParams({
    creation_id: containerId,
    access_token: IG_ACCESS_TOKEN,
  })
  let publishRes: Response
  try {
    publishRes = await fetch(`${GRAPH_BASE}/${IG_USER_ID}/media_publish`, {
      method: 'POST',
      body: publishParams,
    })
  } catch (err: any) {
    return fail(`Could not reach Meta Graph API publishing the container: ${err?.message || String(err)}`)
  }
  const publishData = await publishRes.json()
  if (!publishRes.ok || publishData.error) {
    return fail(publishData?.error?.message || `Meta returned ${publishRes.status} publishing the container.`)
  }
  const igMediaId = publishData.id
  if (!igMediaId) return fail('Meta did not return a media id after publishing.')

  // media_publish only returns a numeric media id -- Instagram post URLs need the shortcode,
  // which requires one more read. Not fatal if this specific call fails; the post is already
  // live at this point, so we still record success and just leave the link blank.
  let permalink: string | null = null
  try {
    const permalinkRes = await fetch(`${GRAPH_BASE}/${igMediaId}?fields=permalink&access_token=${encodeURIComponent(IG_ACCESS_TOKEN)}`)
    const permalinkData = await permalinkRes.json()
    if (permalinkRes.ok && permalinkData.permalink) permalink = permalinkData.permalink
  } catch (err) {
    console.error('social publish: post succeeded but permalink fetch failed', igMediaId, err)
  }

  const { error: updateError } = await supabase
    .from('social_posts')
    .update({ status: 'published', ig_media_id: igMediaId, permalink, published_at: new Date().toISOString(), error: null })
    .eq('id', id)
  if (updateError) {
    // The post really did publish to Instagram -- say so plainly even though the local
    // record-keeping failed, rather than reporting a clean failure for a post that's live.
    return Response.json(
      { ig_media_id: igMediaId, permalink, error: `Published to Instagram, but failed to update the local record: ${updateError.message}` },
      { status: 207 }
    )
  }

  return Response.json({ ig_media_id: igMediaId, permalink })
}
