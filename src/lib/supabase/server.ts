import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicConfig } from './config'

export function createRequestSupabase(request: Request) {
  const config = getSupabasePublicConfig()
  if (!config) return null
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({ name, value: value ?? '' })),
      // Session refresh is handled centrally by src/proxy.ts.
      setAll: () => undefined,
    },
  })
}

export async function createCookieSupabase() {
  const config = getSupabasePublicConfig()
  if (!config) return null
  const cookieStore = await cookies()
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
      },
    },
  })
}

export function requestBearerToken(request: Request) {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
}

export async function authenticatedUserId(request: Request) {
  const supabase = createRequestSupabase(request)
  if (!supabase) return null
  const { data, error } = await supabase.auth.getClaims(requestBearerToken(request))
  if (error || !data?.claims.sub) return null
  return data.claims.sub
}
