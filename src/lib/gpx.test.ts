import { describe, expect, it } from 'vitest'
import { routeToGpx } from './gpx'
import type { PlannedRoute } from './domain'

describe('GPX export', () => {
  it('emits valid GPX-shaped XML and escapes names', () => {
    const route: PlannedRoute = {
      id: 'r1', name: 'Basel & Rhein', createdAt: '2026-08-15T12:00:00.000Z', profile: 'road', mode: 'one-way',
      geometry: { type: 'LineString', coordinates: [[7.5, 47.5], [7.6, 47.6]] }, waypoints: [], warnings: [],
      metrics: { distanceKm: 12, durationMinutes: 30, elevationGainM: 120, elevationLossM: 80, asphaltPercent: 95, cyclewayPercent: 30, confidence: 'preview', elevationProfile: [400, 420] },
    }
    const xml = routeToGpx(route)
    expect(xml).toContain('<gpx version="1.1"')
    expect(xml).toContain('Basel &amp; Rhein')
    expect(xml.match(/<trkpt/g)).toHaveLength(2)
  })
})
