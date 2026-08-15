import { describe, expect, it } from 'vitest'
import type { PlannedRoute } from './domain'
import { analyzeRoute, gradeColor, gradeGradientStops } from './route-analysis'

function route(elevations: number[]): PlannedRoute {
  const coordinates = elevations.map((_, index) => [7.4, 46.9 + index * .001] as [number, number])
  return { id: 'r', name: 'test', createdAt: '', profile: 'road', mode: 'one-way', geometry: { type: 'LineString', coordinates }, waypoints: [], metrics: { distanceKm: 1, durationMinutes: 3, elevationGainM: 0, elevationLossM: 0, asphaltPercent: 0, cyclewayPercent: 0, confidence: 'preview', elevationProfile: elevations }, warnings: [], provenance: { routingEngine: '', primaryDataSource: '', graphVersion: '', dataUpdatedAt: '', analyzedAt: '', regionId: 'ch', confidence: 'low' } }
}

describe('route analysis', () => {
  it('calculates smoothed grades and assigns difficulty colours', () => {
    const analysis = analyzeRoute(route([500, 505, 515, 530]))
    expect(analysis.samples).toHaveLength(4)
    expect(analysis.samples.at(-1)!.gradePercent).toBeGreaterThan(8)
    expect(analysis.samples.at(-1)!.color).toBe(gradeColor(analysis.samples.at(-1)!.gradePercent))
  })

  it('keeps descents green and caps extreme values', () => {
    const analysis = analyzeRoute(route([600, 550, 500]))
    expect(analysis.samples[1].gradePercent).toBeGreaterThanOrEqual(-25)
    expect(analysis.samples[1].color).toBe(gradeColor(-25))
  })

  it('detects sustained climbs with useful summary metrics', () => {
    const analysis = analyzeRoute(route([500, 506, 512, 518, 524, 530, 536]))
    expect(analysis.climbs).toHaveLength(1)
    expect(analysis.climbs[0]).toMatchObject({ gainM: 36 })
    expect(analysis.climbs[0].distanceKm).toBeGreaterThanOrEqual(.5)
  })

  it('creates a bounded continuous line gradient including both ends', () => {
    const analysis = analyzeRoute(route(Array.from({ length: 250 }, (_, index) => 500 + index / 2)))
    const stops = gradeGradientStops(analysis, 20)
    expect(stops[0]).toBe(0)
    expect(stops.at(-2)).toBe(1)
    expect(stops.length).toBeLessThanOrEqual(44)
  })
})
