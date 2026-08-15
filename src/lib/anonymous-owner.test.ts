import { describe, expect, it } from 'vitest'
import { anonymousOwner, withAnonymousOwner } from './anonymous-owner'

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
})
