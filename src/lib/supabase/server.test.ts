import { describe, expect, it } from 'vitest'
import { requestBearerToken } from './server'

describe('Supabase request authentication', () => {
  it('extracts only a bearer access token', () => {
    expect(requestBearerToken(new Request('https://velvetica.vercel.app/api/saved-routes', { headers: { Authorization: 'Bearer account-token' } }))).toBe('account-token')
    expect(requestBearerToken(new Request('https://velvetica.vercel.app/api/saved-routes', { headers: { Authorization: 'Basic ignored' } }))).toBeUndefined()
  })
})
