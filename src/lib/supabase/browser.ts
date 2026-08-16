'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicConfig } from './config'

let browserClient: SupabaseClient | null | undefined

export function getBrowserSupabase() {
  if (typeof window === 'undefined') return null
  if (browserClient !== undefined) return browserClient
  const config = getSupabasePublicConfig()
  browserClient = config ? createBrowserClient(config.url, config.publishableKey) : null
  return browserClient
}
