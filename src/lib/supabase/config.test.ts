import { afterEach, describe, expect, it } from 'vitest'
import { getSupabasePublicConfig, supabaseAuthEnabled } from './config'

const original = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishable: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}

afterEach(() => {
  if (original.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = original.url
  if (original.publishable === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = original.publishable
  if (original.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = original.anon
})

describe('Supabase public configuration', () => {
  it('keeps authentication disabled when the project is not configured', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    expect(getSupabasePublicConfig()).toBeNull()
    expect(supabaseAuthEnabled()).toBe(false)
  })

  it('prefers the current publishable key and supports the legacy anon key', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon'
    expect(getSupabasePublicConfig()?.publishableKey).toBe('legacy-anon')
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_current'
    expect(getSupabasePublicConfig()).toEqual({ url: 'https://example.supabase.co', publishableKey: 'sb_publishable_current' })
  })
})
