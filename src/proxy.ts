import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { getSupabasePublicConfig } from '@/lib/supabase/config'

export async function proxy(request: NextRequest) {
  const config = getSupabasePublicConfig()
  if (!config) return NextResponse.next({ request })

  let response = NextResponse.next({ request })
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
      },
    },
  })

  await supabase.auth.getClaims()
  return response
}

export const config = {
  matcher: ['/', '/api/saved-routes/:path*', '/api/account/:path*', '/auth/:path*'],
}
