import { createCookieSupabase } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const EMAIL_OTP_TYPES = new Set<EmailOtpType>(['email', 'signup', 'invite', 'magiclink', 'recovery', 'email_change'])

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const rawType = url.searchParams.get('type')
  const code = url.searchParams.get('code')
  const flow = url.searchParams.get('flow')
  const destination = new URL('/', url.origin)
  const supabase = await createCookieSupabase()

  if (!supabase) {
    destination.searchParams.set('auth', 'invalid')
    return NextResponse.redirect(destination)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    destination.searchParams.set('auth', error ? 'error' : flow === 'recovery' ? 'recovery' : 'success')
    return NextResponse.redirect(destination)
  }

  if (!tokenHash || !rawType || !EMAIL_OTP_TYPES.has(rawType as EmailOtpType)) {
    destination.searchParams.set('auth', 'invalid')
    return NextResponse.redirect(destination)
  }

  // Supabase's SSR email flow verifies token hashes with `type=email`.
  // Older Velvetia templates used `magiclink`, so try the documented type
  // first and retain the original type as a compatibility fallback.
  const verificationTypes: EmailOtpType[] = rawType === 'magiclink'
    ? ['email', 'magiclink']
    : [rawType as EmailOtpType]
  let error: Error | null = null
  for (const type of verificationTypes) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    error = result.error
    if (!error) break
  }

  destination.searchParams.set('auth', error ? 'error' : rawType === 'recovery' ? 'recovery' : 'success')
  return NextResponse.redirect(destination)
}
