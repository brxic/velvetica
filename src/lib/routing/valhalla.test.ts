import { afterEach, describe, expect, it, vi } from 'vitest'
import { summarizeTraceEdges, ValhallaProvider } from './valhalla'
import { cumulativeDistances } from '../route-analysis'
import { plannedRouteSchema } from '../route-schema'

afterEach(() => vi.unstubAllGlobals())

describe('Valhalla route attributes', () => {
  it('rejects severely retraced automatic loops before requesting extra attributes', async () => {
    const start: [number, number] = [7.4474, 46.948]
    const far: [number, number] = [7.6, 46.948]
    const fetchMock = vi.fn(async () => Response.json({ trip: { summary: { length: 60, time: 6000 }, legs: [{ shape: { type: 'LineString', coordinates: [start, far, start, far, start, far, start] } }] } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(new ValhallaProvider('http://valhalla.test').plan({ locale: 'de', mode: 'round-trip', profile: 'road', targetDistanceKm: 60, waypoints: [{ id: 'start', kind: 'start', label: 'Bern', coordinate: start }], preferences: { safety: 'quiet', climbing: 'balanced', surface: 'balanced' } })).rejects.toThrow('ROUTE_QUALITY_FAILED')
    expect(fetchMock.mock.calls).toHaveLength(24)
  })
  it('retains exact elevation distances after stride sampling, a missing height and the final point', async () => {
    const coordinates = Array.from({ length: 243 }, (_, index) => [7 + index * .0001, 47] as [number, number])
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      const endpoint = new URL(input).pathname
      if (endpoint === '/route') return Response.json({ trip: { summary: { length: 2, time: 600 }, legs: [{ shape: { type: 'LineString', coordinates } }] } })
      if (endpoint === '/height') {
        const shape = JSON.parse(init!.body as string).shape as unknown[]
        return Response.json({ height: shape.map((_, index) => index === 2 ? null : 500 + index) })
      }
      return Response.json(endpoint === '/status' ? { version: 'test' } : { edges: [] })
    }))
    const planned = await new ValhallaProvider('http://valhalla.test').plan({ locale: 'de', mode: 'one-way', profile: 'road', targetDistanceKm: 2, waypoints: [{ id: 'start', label: 'Start', kind: 'start', coordinate: coordinates[0] }, { id: 'end', label: 'End', kind: 'end', coordinate: coordinates.at(-1)! }], preferences: { surface: 'balanced', climbing: 'balanced', safety: 'quiet' } })
    const distances = cumulativeDistances(coordinates)
    expect(planned.metrics.elevationDistancesKm).toHaveLength(planned.metrics.elevationProfile.length)
    expect(planned.metrics.elevationDistancesKm!.slice(0, 3)).toEqual([0, distances[3], distances[9]])
    expect(planned.metrics.elevationDistancesKm!.at(-1)).toBe(distances.at(-1))
    expect(plannedRouteSchema.safeParse(planned).success).toBe(true)
    expect(plannedRouteSchema.safeParse({ ...planned, metrics: { ...planned.metrics, elevationDistancesKm: [1, 0] } }).success).toBe(false)
  })
  it('weights surface and cycleway percentages by edge length', () => {
    const summary = summarizeTraceEdges([
      { length: 8, surface: 'paved_smooth', use: 'road', cycle_lane: 'none' },
      { length: 2, surface: 'gravel', use: 'cycleway', cycle_lane: 'dedicated' },
    ])
    expect(summary.asphaltPercent).toBe(80)
    expect(summary.cyclewayPercent).toBe(20)
    expect(summary.warnings[0]).toContain('20 %')
  })

  it('reports tunnel and dismount evidence without claiming objective safety', () => {
    const summary = summarizeTraceEdges([
      { length: .5, surface: 'paved', use: 'road', tunnel: true },
      { length: .1, surface: 'paved', use: 'steps', dismount: true },
    ])
    expect(summary.warnings).toEqual(expect.arrayContaining([expect.stringContaining('Tunnel'), expect.stringContaining('Schiebe-')]))
    expect(summary.warnings.join(' ')).not.toContain('sicher')
  })

  it('localizes dynamic warnings to English', () => {
    const summary = summarizeTraceEdges([{ length: 1, surface: 'gravel', use: 'road' }], 'en')
    expect(summary.warnings[0]).toBe('100% of the route uses unpaved or unknown surfaces according to OSM.')
  })
})
