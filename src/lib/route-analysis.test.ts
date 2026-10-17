import { describe, expect, it } from 'vitest'
import type { PlannedRoute } from './domain'
import { analyzeRoute, cumulativeDistances, gradeColor, gradeGradientStops, nearestSampleIndex } from './route-analysis'

function route(elevations: number[]): PlannedRoute {
  const coordinates = elevations.map((_, index) => [7.4, 46.9 + index * .001] as [number, number])
  return { id: 'r', name: 'test', createdAt: '', profile: 'road', mode: 'one-way', geometry: { type: 'LineString', coordinates }, waypoints: [], metrics: { distanceKm: 1, durationMinutes: 3, elevationGainM: 0, elevationLossM: 0, asphaltPercent: 0, cyclewayPercent: 0, confidence: 'preview', elevationProfile: elevations }, warnings: [], provenance: { routingEngine: '', primaryDataSource: '', graphVersion: '', dataUpdatedAt: '', analyzedAt: '', regionId: 'ch', confidence: 'low' } }
}

describe('route analysis', () => {
  it('preserves elevation peaks between sparse geometry vertices', () => {
    const sparse = route([500, 600, 500])
    sparse.geometry.coordinates = [[7, 47], [7.1, 47]]
    const total = cumulativeDistances(sparse.geometry.coordinates as [number, number][]).at(-1)!
    sparse.metrics.elevationDistancesKm = [0, total / 2, total]
    const analysis = analyzeRoute(sparse)
    expect(analysis.samples).toHaveLength(3)
    expect(analysis.samples[1].elevationM).toBe(600)
    expect(analysis.samples[1].coordinate[0]).toBeCloseTo(7.05)
    expect(analysis.samples[1].distanceKm).toBeCloseTo(total / 2)
  })
  it('uses distance rather than vertex count for uneven geometry and map colour stops', () => {
    const uneven = route([500, 510, 600])
    uneven.geometry.coordinates = [[7, 47], [7.001, 47], [7.1, 47]]
    const analysis = analyzeRoute(uneven)
    expect(analysis.samples[1].distanceKm / analysis.samples[2].distanceKm).toBeCloseTo(.01, 4)
    expect(gradeGradientStops(analysis)[2]).toBeCloseTo(.01, 4)
    expect(nearestSampleIndex(analysis.samples, analysis.samples[2].distanceKm * .05)).toBe(1)
  })

  it('interpolates explicit sparse elevation samples by distance, not geometry index', () => {
    const sparse = route([500, 510, 600])
    sparse.geometry.coordinates = [[7, 47], [7.001, 47], [7.05, 47], [7.1, 47]]
    const distances = cumulativeDistances(sparse.geometry.coordinates as [number, number][])
    sparse.metrics.elevationDistancesKm = [0, distances[1], distances[3]]
    const analysis = analyzeRoute(sparse)
    expect(analysis.samples[1].elevationM).toBe(510)
    expect(analysis.samples[2].elevationM).toBeCloseTo(555, 0)
  })

  it('keeps duplicate coordinates from producing invalid repeated map stops', () => {
    const duplicate = route([500, 500, 510, 510])
    duplicate.geometry.coordinates = [[7, 47], [7, 47], [7.1, 47], [7.1, 47]]
    const stops = gradeGradientStops(analyzeRoute(duplicate))
    const positions = stops.filter((_, index) => index % 2 === 0) as number[]
    expect(positions).toEqual([0, 1])
    duplicate.geometry.coordinates = [[7, 47], [7, 47]]
    duplicate.metrics.elevationProfile = [500, 500]
    expect(gradeGradientStops(analyzeRoute(duplicate))).toHaveLength(4)
  })
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
