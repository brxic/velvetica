import { describe, expect, it } from 'vitest'
import { planPreviewRoute } from './preview-router'

const start = { id: 'start', coordinate: [7.5886, 47.5596] as [number, number], label: 'Basel', kind: 'start' as const }
const preferences = { surface: 'balanced' as const, climbing: 'balanced' as const, safety: 'balanced' as const }

describe('preview route planner', () => {
  it('creates a closed round trip with usable metrics', () => {
    const route = planPreviewRoute({ locale: 'de', profile: 'road', mode: 'round-trip', targetDistanceKm: 60, waypoints: [start], preferences })
    expect(route.geometry.coordinates.at(0)).toEqual(route.geometry.coordinates.at(-1))
    expect(route.metrics.distanceKm).toBeGreaterThan(55)
    expect(route.metrics.distanceKm).toBeLessThan(65)
    expect(route.metrics.durationMinutes).toBeGreaterThan(0)
    expect(route.metrics.confidence).toBe('preview')
  })

  it('uses an explicit destination for one-way routes', () => {
    const end = { id: 'end', coordinate: [8.3093, 47.0502] as [number, number], label: 'Luzern', kind: 'end' as const }
    const route = planPreviewRoute({ locale: 'de', profile: 'touring', mode: 'one-way', targetDistanceKm: 100, waypoints: [start, end], preferences })
    expect(route.geometry.coordinates.at(-1)).toEqual(end.coordinate)
    expect(route.metrics.elevationLossM).toBeLessThan(route.metrics.elevationGainM)
  })

  it('rejects requests without a starting point', () => {
    expect(() => planPreviewRoute({ locale: 'de', profile: 'city', mode: 'round-trip', targetDistanceKm: 20, waypoints: [], preferences })).toThrow('NO_START')
  })
})
