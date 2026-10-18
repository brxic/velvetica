import { describe, expect, it } from 'vitest'

import type { Coordinate } from '@/lib/domain'
import { compareRouteQuality, createRoundTripSeeds, evaluateRoundTrip, usableRoundTrip } from './round-trip-quality'

const bern: Coordinate = [7.4474, 46.948]

describe('round-trip candidate quality', () => {
  it('creates deterministic, geographically distinct seeds', () => {
    const first = createRoundTripSeeds(bern, 60)
    const second = createRoundTripSeeds(bern, 60)
    expect(first).toEqual(second)
    expect(first).toHaveLength(6)
    expect(new Set(first.map((seed) => JSON.stringify(seed.locations))).size).toBe(6)
  })

  it('accepts a compact loop near the requested distance', () => {
    const loop: Coordinate[] = [bern, [7.65, 47.02], [7.63, 46.82], [7.35, 46.8], bern]
    const quality = evaluateRoundTrip(loop, bern, 61, 60)
    expect(quality.acceptable).toBe(true)
    expect(quality.distanceDeviation).toBeLessThan(.02)
  })

  it('rejects a random out-and-back excursion', () => {
    const excursion: Coordinate[] = [bern, [7.6, 46.95], [8.35, 47.25], [7.6, 46.95], bern]
    const quality = evaluateRoundTrip(excursion, bern, 60, 60)
    expect(quality.acceptable).toBe(false)
    expect(quality.radialExcess + quality.repeatedShare).toBeGreaterThan(.12)
  })
  it('detects retracing even with different vertices on the return leg', () => {
    const geometry: Coordinate[] = [bern, [7.46, 46.948], [7.48, 46.948], [7.475, 46.94801], [7.465, 46.94801], [7.45, 46.94801], bern]
    const quality = evaluateRoundTrip(geometry, bern, 5, 5)
    expect(quality.repeatedShare).toBeGreaterThan(.3)
    expect(quality.acceptable).toBe(false)
  })
  it('does not confuse nearby parallel roads or an isolated crossing with retracing', () => {
    const loop: Coordinate[] = [bern, [7.48, 46.948], [7.48, 46.9485], [7.4474, 46.9485], bern]
    expect(evaluateRoundTrip(loop, bern, 5, 5).repeatedShare).toBeLessThan(.05)
  })
  it('prefers acceptable candidates and rejects extreme geometry even as a fallback', () => {
    const good = evaluateRoundTrip([bern, [7.65, 47.02], [7.63, 46.82], [7.35, 46.8], bern], bern, 61, 60)
    expect(compareRouteQuality(good, { ...good, acceptable: false, score: 0 })).toBeLessThan(0)
    expect(usableRoundTrip({ ...good, repeatedShare: .5 })).toBe(false)
    expect(usableRoundTrip({ ...good, distanceDeviation: .6 })).toBe(false)
    expect(evaluateRoundTrip([bern, [7.5, 47], bern], bern, 60, NaN).acceptable).toBe(false)
  })
})
