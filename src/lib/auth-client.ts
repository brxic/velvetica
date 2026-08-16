'use client'

import { getBrowserSupabase } from './supabase/browser'

export const AUTH_STATE_EVENT = 'velvetia:auth-state-changed'

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const supabase = getBrowserSupabase()
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }
  return fetch(input, { ...init, headers })
}

export function announceAuthState(userId: string | null) {
  window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT, { detail: { userId } }))
}
