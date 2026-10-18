import { describe, expect, it } from 'vitest'
import { rideTestRoute } from '../../test-fixtures/ride-route'
import { DRAFT_TTL_MS, MAX_DRAFT_CHARS, parseWorkspaceDraft, workspaceDraftKey, writeWorkspaceDraft, type WorkspaceDraft } from './workspace-draft'

const draft: WorkspaceDraft = { route: rideTestRoute, mode: 'one-way', profile: 'road', distance: 60, preferences: { surface: 'balanced', climbing: 'avoid', safety: 'quiet' }, waypoints: [] }

describe('workspace recovery envelope', () => {
  it('isolates keys, validates persisted content and expires after seven days', () => {
    const storage = new Map<string, string>()
    const adapter = { setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) }
    const key = workspaceDraftKey('account-a')
    expect(writeWorkspaceDraft(adapter, key, draft, 100_000)).toBe(true)
    expect(storage.has(workspaceDraftKey('account-b'))).toBe(false)
    expect(parseWorkspaceDraft(storage.get(key)!, 100_000)?.workspace.route?.id).toBe(rideTestRoute.id)
    expect(parseWorkspaceDraft(storage.get(key)!, 100_001 + DRAFT_TTL_MS)).toBeNull()
    expect(parseWorkspaceDraft(storage.get(key)!, 1)).toBeNull()
    expect(() => workspaceDraftKey('../other')).toThrow()
  })
  it('rejects corrupt, excessive or incompatible snapshots', () => {
    for (const value of ['{', '{}', 'x'.repeat(MAX_DRAFT_CHARS + 1), JSON.stringify({ version: 2, savedAt: Date.now(), workspace: draft }), JSON.stringify({ version: 1, savedAt: Date.now(), workspace: { ...draft, distance: -1 } })]) expect(parseWorkspaceDraft(value)).toBeNull()
  })
  it('preserves a temporarily blank name, never stores live GPS and handles blocked storage', () => {
    const setItem = (_key: string, value: string) => {
      const envelope = JSON.parse(value)
      expect(parseWorkspaceDraft(value)?.workspace.route?.name).toBe('')
      expect(envelope.workspace).not.toHaveProperty('gps')
    }
    expect(writeWorkspaceDraft({ setItem, removeItem: () => {} }, 'draft', { ...draft, route: { ...rideTestRoute, name: '' } })).toBe(true)
    expect(writeWorkspaceDraft({ setItem: () => { throw new Error('quota') }, removeItem: () => {} }, 'draft', draft)).toBe(false)
  })
  it('clears a discarded workspace rather than resurrecting it on restart', () => {
    let removed = false
    expect(writeWorkspaceDraft({ setItem: () => {}, removeItem: () => { removed = true } }, 'draft', { ...draft, route: null, waypoints: [] })).toBe(true)
    expect(removed).toBe(true)
  })
})
