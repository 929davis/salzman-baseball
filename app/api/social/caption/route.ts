// Server-only. ANTHROPIC_API_KEY never reaches the browser -- this route is the only place
// that reads it, and it's a Route Handler (server), never a client component.
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You write Instagram captions for a college-pitching coach's account. The coach trains college-level pitchers; the audience is other coaches and serious players.

Voice: direct and specific, like a coach who has actually done the work. No hype, no motivational-poster register, no exclamation points doing the enthusiasm for you.

The caption restates or extends the idea in the source text -- it does not summarize an image, because the image IS the text, rendered as a card. Assume the reader already saw the card.

End with exactly one question. It must be answerable only by someone who actually read this specific post -- a real coaching question with a defensible answer people could disagree about. Never a generic engagement prompt.

Banned outright, in any form: "comment below", "tag a friend", "let me know in the comments", "double tap", "like if you agree", "drop a [emoji]", or any variant asking for a mechanical interaction rather than a real answer. These are engagement bait under Meta's content distribution guidelines and cost recommendation eligibility to non-followers -- the entire growth channel this account depends on. A genuine, specific question is not engagement bait; a demand for an interaction is.

Length: well under Instagram's 2,200 character limit. Aim for 3-6 short lines.

No hashtags unless the content genuinely calls for one or two -- most posts should have none. Do not add a hashtag block by default.

Output plain text only. No preamble like "Here's a caption:", no markdown formatting, no surrounding quote marks.

You will also be shown up to 10 of this account's own previously published captions. Do not reuse their structure, opening line, or question shape -- each caption should feel like its own piece of writing, not a template filled in again.`

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
    .from('social_posts').select('source_text').eq('id', id).maybeSingle()
  if (rowError) return Response.json({ error: `Database error: ${rowError.message}` }, { status: 500 })
  if (!row) return Response.json({ error: 'No post found for this id.' }, { status: 404 })

  const { data: recent, error: recentError } = await supabase
    .from('social_posts')
    .select('caption')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(10)
  if (recentError) {
    // Not fatal to caption drafting -- proceed without prior-caption context rather than
    // failing the whole request, but don't pretend this didn't happen.
    console.error('social caption: failed to load recent captions', recentError)
  }
  const priorCaptions = (recent || []).map(r => r.caption).filter(Boolean) as string[]

  const userContent = priorCaptions.length
    ? `SOURCE POST:\n${row.source_text}\n\nPREVIOUSLY PUBLISHED CAPTIONS (do not reuse their structure, opening, or question shape):\n${priorCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}`
    : `SOURCE POST:\n${row.source_text}`

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }, { status: 500 })
  }

  let anthropicRes: Response
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
  } catch (err: any) {
    // Network failure reaching Anthropic at all -- caption stays empty, tool stays usable.
    return Response.json({ error: `Could not reach Anthropic API: ${err?.message || String(err)}` }, { status: 502 })
  }

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text()
    return Response.json({ error: `Anthropic API error (${anthropicRes.status}): ${errBody}` }, { status: 502 })
  }

  const data = await anthropicRes.json()
  const caption = data?.content?.[0]?.text?.trim()
  if (!caption) {
    return Response.json({ error: 'Anthropic returned an empty response.' }, { status: 502 })
  }

  const { error: updateError } = await supabase
    .from('social_posts').update({ caption }).eq('id', id)
  if (updateError) {
    // The model did produce a caption -- return it so it's not lost, but say plainly that
    // it wasn't saved, rather than pretending it was.
    return Response.json(
      { caption, error: `Caption generated but failed to save: ${updateError.message}` },
      { status: 207 }
    )
  }

  return Response.json({ caption })
}
