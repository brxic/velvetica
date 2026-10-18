import { afterEach, expect, it, vi } from 'vitest'
import { GET } from './route'
const { userId } = vi.hoisted(() => ({ userId: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ authenticatedUserId: userId }))
afterEach(() => vi.clearAllMocks())

it('returns a stable private scope without depending on the database', async () => {
  userId.mockResolvedValue('account-a')
  const response = await GET(new Request('http://localhost/api/workspace'))
  const payload = await response.json()
  expect(payload.authenticated).toBe(true)
  expect(payload.storageScope).toMatch(/^[a-f0-9]{24}$/)
  expect(JSON.stringify(payload)).not.toContain('account-a')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
})
it('refuses to turn a failed account verification into a guest identity', async () => {
  userId.mockResolvedValue(null)
  for (const headers of [new Headers({ authorization: 'Bearer invalid' }), new Headers({ cookie: 'sb-project-auth-token.0=invalid' })]) expect((await GET(new Request('http://localhost/api/workspace', { headers }))).status).toBe(401)
})
it('issues an HttpOnly guest cookie and reuses its scope', async () => {
  userId.mockResolvedValue(null)
  const first = await GET(new Request('http://localhost/api/workspace'))
  const cookie = first.headers.get('set-cookie')!
  expect(cookie).toContain('HttpOnly')
  const second = await GET(new Request('http://localhost/api/workspace', { headers: { cookie: cookie.split(';')[0] } }))
  expect(await first.json()).toEqual(await second.json())
})
