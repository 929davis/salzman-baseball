// PUBLIC route -- no auth. Meta's servers cURL this URL directly to fetch the image when
// publishing a media container, and they have no session to authenticate with. Do not add
// auth here; do not accept arbitrary text via query string (that would make this an open
// image generator) -- it only ever reads text that was already saved to a row by an
// authenticated coach via the /social page.
//
// Reads with the service-role key deliberately: this is the one legitimate reason to bypass
// RLS in this feature (see sql/social_posts.sql's comment). Never expose this key to a
// client bundle.
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { CardTemplate, CARD_SIZE, CARD_TEXT_MAX_LENGTH } from '@/lib/social/card-template'

export const runtime = 'nodejs'

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

// Read once per server instance rather than per-request -- the file never changes at runtime,
// and next/og's Satori renderer needs an actual data URI, not a relative /public path (this
// route doesn't run behind the same static file serving as a normal page).
let avatarDataUri: string | null = null
function getAvatarDataUri(): string {
  if (avatarDataUri) return avatarDataUri
  const filePath = path.join(process.cwd(), 'public', 'social', 'avatar.png')
  const bytes = fs.readFileSync(filePath)
  avatarDataUri = `data:image/png;base64,${bytes.toString('base64')}`
  return avatarDataUri
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = admin()
  const { data: row, error } = await supabase
    .from('social_posts')
    .select('source_text')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('social card: failed to read row', id, error)
    return new Response(`Database error: ${error.message}`, { status: 500 })
  }
  if (!row) {
    return new Response('No post found for this id.', { status: 404 })
  }

  const text = row.source_text || ''
  if (text.length > CARD_TEXT_MAX_LENGTH) {
    return new Response(
      `This post is ${text.length} characters, over the ${CARD_TEXT_MAX_LENGTH}-character card limit. Shorten it and regenerate.`,
      { status: 422 }
    )
  }

  try {
    const png = new ImageResponse(
      <CardTemplate text={text} avatarDataUri={getAvatarDataUri()} />,
      {
        width: CARD_SIZE,
        height: CARD_SIZE,
      }
    )

    // Instagram's Content Publishing API supports JPEG only (extended JPEG formats like MPO
    // and JPS are not supported, and PNG isn't accepted at all) -- ImageResponse only
    // produces PNG, so this conversion is not optional.
    const pngBuffer = Buffer.from(await png.arrayBuffer())
    const jpegBuffer = await sharp(pngBuffer)
      .toColorspace('srgb') // Instagram converts anything else and can shift colors
      .jpeg({ quality: 90 })
      .toBuffer()

    return new Response(new Uint8Array(jpegBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        // Short cache: the coach may edit the source text and regenerate. The UI adds a
        // cache-busting query param on regeneration for the immediate case; this covers
        // Meta's own fetch (which happens once, at publish time, and should always be fresh
        // for whatever caption/text state exists then).
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err: any) {
    console.error('social card: render failed', id, err)
    return new Response(`Card render failed: ${err?.message || String(err)}`, { status: 500 })
  }
}
