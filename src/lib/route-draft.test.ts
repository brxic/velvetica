import { describe, expect, it } from 'vitest'
import type { PlannedRoute } from './domain'
import { acknowledgeSavedDraft } from './route-draft'

const submitted = { id: 'one', name: 'Original', description: '', geometry: { type: 'LineString', coordinates: [[7, 47], [7.1, 47]] }, metrics: { distanceKm: 8 }, waypoints: [], profile: 'road', mode: 'one-way' } as unknown as PlannedRoute
const acknowledged = { ...submitted, serverVersion: 2 }

describe('save acknowledgement', () => {
  it('updates the exact submitted draft with the server version', () => {
    expect(acknowledgeSavedDraft(submitted, submitted, acknowledged)).toBe(acknowledged)
  })
  it('preserves edits made while saving and advances the optimistic concurrency token', () => {
    const changed = { ...submitted, name: 'New name', description: 'Still editing', geometry: { ...submitted.geometry, coordinates: [[7, 47], [7.2, 47]] } }
    expect(acknowledgeSavedDraft(changed, submitted, acknowledged)).toEqual({ ...changed, serverVersion: 2 })
  })
  it('never reopens a discarded draft or replaces another route', () => {
    expect(acknowledgeSavedDraft(null, submitted, acknowledged)).toBeNull()
    const other = { ...submitted, id: 'two' }
    expect(acknowledgeSavedDraft(other, submitted, acknowledged)).toBe(other)
  })
})
