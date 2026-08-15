import { describe, expect, it } from 'vitest'

import type { Coordinate } from '@/lib/domain'
import { createRoundTripSeeds, evaluateRoundTrip } from './round-trip-quality'

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
})
