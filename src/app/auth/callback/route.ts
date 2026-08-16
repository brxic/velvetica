import { createCookieSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const destination = new URL('/', url.origin)
  const supabase = await createCookieSupabase()
  if (!supabase || !code) {
    destination.searchParams.set('auth', 'invalid')
    return NextResponse.redirect(destination)
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  destination.searchParams.set('auth', error ? 'error' : 'success')
  return NextResponse.redirect(destination)
}
