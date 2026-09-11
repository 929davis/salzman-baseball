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

// Shared by both the single-image and carousel-item containers. URLSearchParams handles
// encoding image_url and any text params (which may contain newlines, apostrophes, and a
// literal `#` -- Meta's container call fails if `#` isn't percent-encoded, and
// URLSearchParams does this correctly).
async function createContainer(
  igUserId: string,
  accessToken: string,
  params: Record<string, string>
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const body = new URLSearchParams({ ...params, access_token: accessToken })
  let res: Response
  try {
    res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, { method: 'POST', body })
  } catch (err: any) {
    return { ok: false, error: `Could not reach Meta Graph API creating a media container: ${err?.message || String(err)}` }
  }
  const data = await res.json()
  if (!res.ok || data.error) {
    return { ok: false, error: data?.error?.message || `Meta returned ${res.status} creating a media container.` }
  }
  if (!data.id) return { ok: false, error: 'Meta did not return a container id.' }
  return { ok: true, id: data.id }
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

  // Resolve the list of image URLs for this post, whatever type it is. A single URL publishes
  // as a plain image; 2+ publish as a carousel. This is the one place that decision is made,
  // so "photo" posts with exactly one photo behave exactly like "single" posts.
  let imageUrls: string[]
  if (row.post_type === 'thread') {
    const segments: string[] = Array.isArray(row.segments) ? row.segments : []
    if (segments.length < 2 || segments.length > 10) {
      return Response.json({ error: `This thread has ${segments.length} part(s) -- Instagram carousels need between 2 and 10.` }, { status: 400 })
    }
    imageUrls = segments.map((_, i) => `${SITE_URL}/api/social/card/${id}?slide=${i}`)
  } else if (row.post_type === 'photo') {
    const photoUrls: string[] = Array.isArray(row.photo_urls) ? row.photo_urls : []
    if (photoUrls.length < 1 || photoUrls.length > 10) {
      return Response.json({ error: `This post has ${photoUrls.length} photo(s) -- needs between 1 and 10.` }, { status: 400 })
    }
    imageUrls = photoUrls
  } else {
    imageUrls = [`${SITE_URL}/api/social/card/${id}`]
  }

  async function fail(message: string) {
    await supabase.from('social_posts').update({ status: 'failed', error: message }).eq('id', id)
    return Response.json({ error: message }, { status: 502 })
  }

  let creationId: string

  if (imageUrls.length === 1) {
    const single = await createContainer(IG_USER_ID, IG_ACCESS_TOKEN, {
      image_url: imageUrls[0],
      caption: row.caption,
    })
    if (!single.ok) return fail(single.error)
    creationId = single.id
  } else {
    // Carousel: one "item" container per image (no caption on items -- caption goes on the
    // parent only), then a parent container referencing all of them.
    const itemIds: string[] = []
    for (let i = 0; i < imageUrls.length; i++) {
      const item = await createContainer(IG_USER_ID, IG_ACCESS_TOKEN, {
        image_url: imageUrls[i],
        is_carousel_item: 'true',
      })
      if (!item.ok) return fail(`Slide ${i + 1} of ${imageUrls.length}: ${item.error}`)
      itemIds.push(item.id)
    }

    const parent = await createContainer(IG_USER_ID, IG_ACCESS_TOKEN, {
      media_type: 'CAROUSEL',
      children: itemIds.join(','),
      caption: row.caption,
    })
    if (!parent.ok) return fail(parent.error)
    creationId = parent.id
  }

  // Confirm the container finished processing before publishing it.
  const status = await pollContainerStatus(creationId, IG_ACCESS_TOKEN)
  if (!status.ok) return fail(status.error)

  // Publish.
  const publishParams = new URLSearchParams({
    creation_id: creationId,
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
