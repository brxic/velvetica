import { describe, expect, it } from 'vitest'
import type { Coordinate } from './domain'
import { createRideTrack, locateRidePosition, locationAccuracyRing, rideableSource, usableRideFix, type RideFix } from './ride-progress'

import { rideTestRoute } from '../../test-fixtures/ride-route'
const fix = (coordinate: Coordinate, timestamp = 100_000): RideFix => ({ coordinate, accuracyM: 5, timestamp, speedMps: null })

describe('ride progress', () => {
  it('projects onto segments and calculates remaining ascent without a vertex jump', () => {
    const track = createRideTrack(rideTestRoute)
    const progress = locateRidePosition(track, fix([7.445, 46.95]), null)
    expect(progress.distanceKm / track.totalKm).toBeCloseTo(.25, 3)
    expect(progress.remainingAscentM).toBe(20)
    expect(progress.remainingMinutes).toBe(5)
    expect(progress.offRoute).toBe(false)
  })
  it('does not mark a loop as complete at its shared start/finish', () => {
    const track = createRideTrack({ ...rideTestRoute, mode: 'round-trip', geometry: { type: 'LineString', coordinates: [[7.44, 46.95], [7.45, 46.96], [7.46, 46.95], [7.44, 46.95]] } })
    const initial = locateRidePosition(track, fix([7.44, 46.95]), null)
    expect(initial.distanceKm).toBe(0)
    expect(initial.arrived).toBe(false)
    const nearEnd = { ...initial, distanceKm: track.totalKm - .05, remainingKm: .05 }
    expect(locateRidePosition(track, fix([7.44, 46.95], 110_000), nearEnd).arrived).toBe(true)
  })
  it('permits riding backwards and freezes progress off route until rejoining', () => {
    const track = createRideTrack(rideTestRoute)
    const initial = locateRidePosition(track, fix([7.45, 46.95]), null)
    const backwards = locateRidePosition(track, fix([7.449, 46.95], 110_000), initial)
    expect(backwards.distanceKm).toBeLessThan(initial.distanceKm)
    const away = locateRidePosition(track, fix([7.46, 46.96], 120_000), backwards)
    expect(away.offRoute).toBe(true)
    expect(away.distanceKm).toBe(backwards.distanceKm)
    expect(away.arrived).toBe(false)
    expect(away.timestamp).toBe(backwards.timestamp)
    expect(locateRidePosition(track, fix([7.455, 46.95], 300_000), away).offRoute).toBe(false)
  })
  it('resolves a figure-eight crossing using previous route progress', () => {
    const track = createRideTrack({ ...rideTestRoute, geometry: { type: 'LineString', coordinates: [[7.44, 46.94], [7.45, 46.95], [7.46, 46.96], [7.44, 46.96], [7.45, 46.95], [7.46, 46.94]] } })
    const initial = locateRidePosition(track, fix([7.45, 46.95]), null)
    expect(initial.distanceKm).toBeCloseTo(track.distances[1], 3)
    const later = locateRidePosition(track, fix([7.45, 46.95], 120_000), { ...initial, distanceKm: track.distances[4] - .02 })
    expect(later.distanceKm).toBeCloseTo(track.distances[4], 3)
  })
  it('rejects stale, inaccurate, out-of-order, invalid and teleporting fixes', () => {
    const first = fix([7.44, 46.95])
    expect(usableRideFix(first, null, 100_000)).toBe(true)
    for (const next of [{ ...first, accuracyM: 81 }, { ...first, timestamp: 1 }, { ...first, coordinate: [Infinity, 47] as Coordinate }, { ...first, coordinate: [181, 47] as Coordinate }]) expect(usableRideFix(next, null, 100_000)).toBe(false)
    expect(usableRideFix(fix([7.44, 46.95], 99_000), first, 100_000)).toBe(false)
    expect(usableRideFix(fix([8.44, 46.95], 101_000), first, 101_000)).toBe(false)
  })
  it('does not invent ascent or time when the underlying data is unavailable', () => {
    const track = createRideTrack({ ...rideTestRoute, metrics: { ...rideTestRoute.metrics, elevationAnalyzed: false, durationMinutes: 0 } })
    const progress = locateRidePosition(track, fix([7.445, 46.95]), null)
    expect(progress.remainingAscentM).toBeNull()
    expect(progress.remainingMinutes).toBeNull()
  })
  it('retains a long legitimate climb rather than discarding every rise over 80 metres', () => {
    const track = createRideTrack({ ...rideTestRoute, metrics: { ...rideTestRoute.metrics, elevationProfile: [500, 600, 700] } })
    expect(locateRidePosition(track, fix([7.44, 46.95]), null).remainingAscentM).toBe(200)
  })
  it('permits original GPX tracks but never simulated routing previews', () => {
    expect(rideableSource({ ...rideTestRoute, metrics: { ...rideTestRoute.metrics, confidence: 'preview' } })).toBe(false)
    expect(rideableSource({ ...rideTestRoute, metrics: { ...rideTestRoute.metrics, confidence: 'preview' }, provenance: { ...rideTestRoute.provenance, routingEngine: 'GPX Import' } })).toBe(true)
    const ring = locationAccuracyRing(fix([7.44, 46.95]))
    expect(ring.geometry.coordinates[0]).toHaveLength(49)
    expect(ring.geometry.coordinates[0][0][0]).toBeCloseTo(ring.geometry.coordinates[0].at(-1)![0], 8)
  })
})
