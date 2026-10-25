// Server-only. ANTHROPIC_API_KEY never reaches the browser. Only called by an explicit
// "Triage" / "Retry triage" click from app/ideas/page.tsx -- there is no automatic or
// scheduled trigger. Triage only writes ai_* columns on the idea's own row (see
// lib/ideas.ts's runTriage) -- nothing here publishes anything or calls Instagram/YouTube.
import { createClient } from '@/lib/supabase/server'
import { runTriage } from '@/lib/ideas'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError) return Response.json({ error: `Auth check failed: ${profileError.message}` }, { status: 500 })
  if (profile?.role !== 'coach') return Response.json({ error: 'Coach access only.' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }) }
  const ideaId = (body as { ideaId?: unknown } | null)?.ideaId
  if (typeof ideaId !== 'string' || !ideaId) {
    return Response.json({ error: 'ideaId is required.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }, { status: 500 })

  const result = await runTriage({ supabase, fetchImpl: fetch, ideaId, apiKey })
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status })
  return Response.json({ ok: true, triage: result.data, statusAdvanced: result.statusAdvanced })
}
