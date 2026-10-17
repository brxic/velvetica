import { describe, expect, it } from 'vitest'
import { canApplyPwaUpdate, PWA_UPDATE_CHECK } from './pwa'

describe('PWA update draft guard', () => {
  it('allows a reload without an active editor veto', () => { expect(canApplyPwaUpdate()).toBe(true) })
  it('honours a synchronous editor veto without exposing any draft contents', () => {
    const block = (event: Event) => event.preventDefault()
    window.addEventListener(PWA_UPDATE_CHECK, block)
    try { expect(canApplyPwaUpdate()).toBe(false) } finally { window.removeEventListener(PWA_UPDATE_CHECK, block) }
    expect(canApplyPwaUpdate()).toBe(true)
  })
})
