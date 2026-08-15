import { describe, expect, it } from 'vitest'
import { createRouteName } from './route-name'

describe('createRouteName', () => {
  it('combines the start place, profile and route type', () => {
    expect(createRouteName('de', 'road', 'round-trip', [{ id: '1', coordinate: [7.4, 46.9], label: 'Bern, BE', kind: 'start' }])).toBe('Bern Rennrad-Runde')
  })

  it('uses the brand when no useful place label exists', () => {
    expect(createRouteName('en', 'gravel', 'one-way', [{ id: '1', coordinate: [7.4, 46.9], label: 'Start', kind: 'start' }])).toBe('Velvetia Gravel route')
  })
})
