import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlanningRequest } from '@/lib/domain'
import { FossgisBikeProvider, wgs84ToLv95 } from './fossgis'

const request: PlanningRequest = { locale: 'de', profile: 'road', mode: 'one-way', targetDistanceKm: 10, waypoints: [{ id: 'a', coordinate: [7.4474, 46.948], label: 'Bern', kind: 'start' }, { id: 'b', coordinate: [7.46, 46.96], label: 'Ziel', kind: 'end' }], preferences: { surface: 'balanced', climbing: 'balanced', safety: 'quiet' } }

afterEach(() => vi.unstubAllGlobals())

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
      .mockResolvedValueOnce(new Response(JSON.stringify([{ alts: { COMB: 530 } }, { alts: { COMB: 550 } }, { alts: { COMB: 540 } }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const route = await new FossgisBikeProvider().plan(request)
    expect(route.geometry.coordinates).toHaveLength(3)
    expect(route.metrics).toMatchObject({ distanceKm: 2.5, durationMinutes: 10, elevationGainM: 20, elevationLossM: 10, confidence: 'verified' })
    expect(route.provenance.routingEngine).toBe('FOSSGIS OSRM Bike')
    expect(fetchMock.mock.calls[0][0]).toContain('/routed-bike/route/v1/driving/')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api3.geo.admin.ch/rest/services/profile.json')
  })
})
