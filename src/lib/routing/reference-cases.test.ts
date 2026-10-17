import { describe, expect, it } from 'vitest'
import cases from '../../../test-fixtures/routing-reference-cases.json'
import { evaluateRoundTrip } from './round-trip-quality'
import { planPreviewRoute } from '../preview-router'
import { plannedRouteSchema } from '../route-schema'
import type { BikeProfile, Coordinate } from '../domain'

describe('regional regression corpus (geometry invariants, not road suitability)', () => {
  for (const reference of cases) {
    it(`${reference.id}: closed round trip and exact one-way destination`, () => {
      const start = { id: 'start', label: reference.region, kind: 'start' as const, coordinate: reference.start as Coordinate }
      const request = { locale: 'de' as const, profile: reference.profile as BikeProfile, mode: 'round-trip' as const, targetDistanceKm: reference.distanceKm, waypoints: [start], preferences: { surface: 'balanced' as const, climbing: 'balanced' as const, safety: 'quiet' as const } }
      const roundTrip = planPreviewRoute(request)
      expect(plannedRouteSchema.safeParse(roundTrip).success).toBe(true)
      expect(evaluateRoundTrip(roundTrip.geometry.coordinates as Coordinate[], start.coordinate, roundTrip.metrics.distanceKm, reference.distanceKm).acceptable).toBe(true)
      const oneWay = planPreviewRoute({ ...request, mode: 'one-way', waypoints: [start, { id: 'end', label: 'Ziel', kind: 'end', coordinate: reference.end as Coordinate }] })
      expect(oneWay.geometry.coordinates.at(-1)).toEqual(reference.end)
    })
  }
  it('rejects open, invalid and excessive out-and-back candidates', () => {
    const start: Coordinate = [7.4474, 46.948]
    expect(evaluateRoundTrip([start, [7.5, 47], [7.6, 47.1]], start, 60, 60).acceptable).toBe(false)
    expect(evaluateRoundTrip([start, [NaN, 47], start], start, 60, 60).acceptable).toBe(false)
    expect(evaluateRoundTrip([start, [7.6, 47], start, [7.6, 47], start], start, 60, 60).acceptable).toBe(false)
  })
})
