import { describe, expect, it } from 'vitest'
import { anonymousOwner, routeOwner, withAnonymousOwner } from './anonymous-owner'

describe('anonymous route ownership', () => {
  it('reuses only valid version-4 owner cookies', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    expect(anonymousOwner(new Request('http://localhost/api', { headers: { cookie: `velvetia_anonymous_id=${id}` } }))).toMatchObject({ ownerKey: id, setCookie: false, secure: false })
    expect(anonymousOwner(new Request('http://localhost/api', { headers: { cookie: 'velvetia_anonymous_id=forged' } })).setCookie).toBe(true)
  })

  it('adds Secure only for HTTPS requests', () => {
    const response = withAnonymousOwner(new Response(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true, true)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax')
    expect(response.headers.get('set-cookie')).toContain('Secure')
  })

  it('creates stable, non-public storage scopes for anonymous browser owners', async () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const first = await routeOwner(new Request('http://localhost/api', { headers: { cookie: `velvetia_anonymous_id=${firstId}` } }))
    const same = await routeOwner(new Request('http://localhost/api', { headers: { cookie: `velvetia_anonymous_id=${firstId}` } }))
    const second = await routeOwner(new Request('http://localhost/api', { headers: { cookie: `velvetia_anonymous_id=${secondId}` } }))
    expect(first.storageScope).toBe(same.storageScope)
    expect(first.storageScope).not.toContain(firstId)
    expect(first.storageScope).not.toBe(second.storageScope)
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
  })
})
