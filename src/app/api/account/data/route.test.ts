import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUser, signIn, remove, exportData } = vi.hoisted(() => ({ getUser: vi.fn(), signIn: vi.fn(), remove: vi.fn(), exportData: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createRequestSupabase: () => ({ auth: { getUser, signInWithPassword: signIn } }), requestBearerToken: () => 'test-token' }))
vi.mock('@/lib/saved-route-store', () => ({ deleteAccount: remove, exportAccount: exportData }))
import { DELETE, GET } from './route'

const user = { id: 'user-a', email: 'a@example.test', created_at: '2026-01-01T00:00:00Z' }
const request = (body: unknown) => new Request('https://velvetia.test/api/account/data', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const deleteStatus = async (body: unknown) => (await DELETE(request(body))).status
beforeEach(() => { vi.resetAllMocks(); getUser.mockResolvedValue({ data: { user }, error: null }); signIn.mockResolvedValue({ data: { user }, error: null }); remove.mockResolvedValue(undefined); exportData.mockResolvedValue({ routes: [], versions: [] }) })

describe('account data boundary', () => {
  it('rejects unauthenticated exports and deletions before accessing data', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })
    expect((await GET(new Request('https://velvetia.test/api/account/data'))).status).toBe(401)
    expect(await deleteStatus({ confirmation: 'DELETE', password: 'valid-password' })).toBe(401)
    expect(remove).not.toHaveBeenCalled(); expect(exportData).not.toHaveBeenCalled()
  })
  it('requires explicit confirmation and checks the password on the Auth server', async () => {
    expect(await deleteStatus({ password: 'valid-password' })).toBe(400)
    signIn.mockResolvedValue({ data: { user: null }, error: new Error('wrong password') })
    expect(await deleteStatus({ confirmation: 'DELETE', password: 'wrong' })).toBe(403)
    expect(remove).not.toHaveBeenCalled()
  })
  it('deletes only the verified identity and rolls backend errors into a retryable response', async () => {
    expect(await deleteStatus({ confirmation: 'DELETE', password: 'valid-password' })).toBe(204)
    expect(remove).toHaveBeenCalledExactlyOnceWith(user.id)
    remove.mockRejectedValue(new Error('database unavailable'))
    expect(await deleteStatus({ confirmation: 'DELETE', password: 'valid-password' })).toBe(503)
  })
  it('never accepts a different identity returned from password verification', async () => {
    signIn.mockResolvedValue({ data: { user: { ...user, id: 'user-b' } }, error: null })
    expect(await deleteStatus({ confirmation: 'DELETE', password: 'valid-password' })).toBe(403)
    expect(remove).not.toHaveBeenCalled()
  })
  it('exports only the verified account and forbids shared caching', async () => {
    const response = await GET(new Request('https://velvetia.test/api/account/data'))
    expect(exportData).toHaveBeenCalledExactlyOnceWith(user.id)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await response.json()).account.email).toBe(user.email)
  })
})
