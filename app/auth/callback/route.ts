import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        // A failed/missing profile lookup used to fall through to '/pitcher' unconditionally.
        // Fall through to the /auth/login redirect at the bottom instead of guessing a role.
        if (!profileError && profile) {
          if (profile.role === 'coach') {
            return NextResponse.redirect(`${origin}/coach`)
          }
          return NextResponse.redirect(`${origin}/pitcher`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
