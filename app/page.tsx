import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // A failed or missing profile lookup used to fall through to `redirect('/pitcher')`
  // unconditionally -- which could put a coach on the wrong dashboard on a transient error,
  // and combined with /coach and /pitcher's own role guards, produce a redirect loop between
  // them. Send back to login instead of guessing a role.
  if (error || !profile) redirect('/auth/login')
  if (profile.role === 'coach') redirect('/coach')
  redirect('/pitcher')
}
