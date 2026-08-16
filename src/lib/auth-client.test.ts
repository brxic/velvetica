import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase/browser', () => ({
  getBrowserSupabase: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'verified-account-token' } } }),
    },
  }),
}))

import { authenticatedFetch } from './auth-client'

describe('authenticated cloud requests', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the current Supabase access token as a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await authenticatedFetch('/api/saved-routes', { headers: { Accept: 'application/json' } })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer verified-account-token')
    expect(headers.get('Accept')).toBe('application/json')
  })
})
