import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlanningRequest } from '@/lib/domain'
import { FossgisBikeProvider, wgs84ToLv95 } from './fossgis'

const request: PlanningRequest = { locale: 'de', profile: 'road', mode: 'one-way', targetDistanceKm: 10, waypoints: [{ id: 'a', coordinate: [7.4474, 46.948], label: 'Bern', kind: 'start' }, { id: 'b', coordinate: [7.46, 46.96], label: 'Ziel', kind: 'end' }], preferences: { surface: 'balanced', climbing: 'balanced', safety: 'quiet' } }

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('FOSSGIS bicycle routing', () => {
  it('converts WGS84 coordinates to plausible Swiss LV95 values', () => {
    const [easting, northing] = wgs84ToLv95([7.4386, 46.9511])
    expect(easting).toBeGreaterThan(2_599_000)
    expect(easting).toBeLessThan(2_601_000)
    expect(northing).toBeGreaterThan(1_199_000)
    expect(northing).toBeLessThan(1_201_000)
  })

  it('returns road-following OSRM geometry and swisstopo elevations', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 2500, duration: 600, geometry: { type: 'LineString', coordinates: [[7.4474, 46.948], [7.452, 46.954], [7.46, 46.96]] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ dist: 0, alts: { COMB: 530 } }, { dist: 50 }, { dist: 100, alts: { COMB: 550 } }, { dist: 1000, alts: { COMB: 540 } }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const route = await new FossgisBikeProvider().plan(request)
    expect(route.geometry.coordinates).toHaveLength(3)
    expect(route.metrics).toMatchObject({ distanceKm: 2.5, durationMinutes: 10, elevationGainM: 20, elevationLossM: 10, confidence: 'verified' })
    expect(route.provenance.routingEngine).toBe('FOSSGIS OSRM Bike')
    expect(route.metrics.elevationDistancesKm).toHaveLength(3)
    expect(route.metrics.elevationDistancesKm![0]).toBe(0)
    expect(route.metrics.elevationDistancesKm![1] / route.metrics.elevationDistancesKm!.at(-1)!).toBeCloseTo(.1, 2)
    expect(fetchMock.mock.calls[0][0]).toContain('/routed-bike/route/v1/driving/')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api3.geo.admin.ch/rest/services/profile.json')
  })

  it('replaces an excursion with a better complete road-following loop', async () => {
    vi.useFakeTimers()
    const start = request.waypoints[0].coordinate
    const excursion = [start, [8.35, 47.25], start, [8.35, 47.25], start]
    const compact = [start, [7.65, 47.02], [7.63, 46.82], [7.35, 46.8], start]
    const response = (coordinates: number[][], distance: number) => Response.json({ code: 'Ok', routes: [{ distance, duration: 6000, geometry: { type: 'LineString', coordinates } }] })
    const fetchMock = vi.fn().mockResolvedValueOnce(response(excursion, 60_000)).mockResolvedValueOnce(response(compact, 61_000)).mockResolvedValueOnce(Response.json([{ alts: { COMB: 500 } }, { alts: { COMB: 510 } }]))
    vi.stubGlobal('fetch', fetchMock)
    const planned = new FossgisBikeProvider().plan({ ...request, mode: 'round-trip', targetDistanceKm: 60, waypoints: [request.waypoints[0]] })
    await vi.runAllTimersAsync()
    expect((await planned).geometry.coordinates).toEqual(compact)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
