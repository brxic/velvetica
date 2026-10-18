import { describe, expect, it } from 'vitest'
import type { Coordinate, PlanningRequest } from '../domain'
import { validateRoutedGeometry } from './geometry-quality'

const start: Coordinate = [7.4474, 46.948], end: Coordinate = [7.46, 46.96]
const request: PlanningRequest = { locale: 'de', mode: 'one-way', profile: 'road', targetDistanceKm: 5, waypoints: [{ id: 'a', kind: 'start', label: 'Bern', coordinate: start }, { id: 'b', kind: 'end', label: 'Ziel', coordinate: end }], preferences: { safety: 'quiet', surface: 'balanced', climbing: 'balanced' } }

describe('provider geometry integrity', () => {
  it('preserves a complete route with explicit user waypoints', () => {
    const geometry: Coordinate[] = [start, [7.455, 46.958], end]
    expect(() => validateRoutedGeometry(geometry, 2, request)).not.toThrow()
    expect(geometry).toEqual([start, [7.455, 46.958], end])
  })
  it('rejects missing endpoints, invalid coordinates and inconsistent distance', () => {
    expect(() => validateRoutedGeometry([start, [8, 47]], 2, request)).toThrow('ENDPOINT')
    expect(() => validateRoutedGeometry([start, [NaN, 47], end], 2, request)).toThrow('INVALID')
    expect(() => validateRoutedGeometry([start, end], 200, request)).toThrow('DISCONTINUITY')
  })
  it('rejects a single long teleport inside an otherwise dense track', () => {
    const geometry: Coordinate[] = [start, ...Array.from({ length: 22 }, (_, index) => [7.4474 + index * .00001, 46.948] as Coordinate), [8.4474, 47.948], end]
    expect(() => validateRoutedGeometry(geometry, 300, request)).toThrow('DISCONTINUITY')
  })
})
