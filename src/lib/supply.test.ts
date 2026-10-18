import { describe, expect, it } from 'vitest'
import { prepareSupplyStop, projectOnRoute, spliceSupplyStop, type SupplyPoi } from './supply'
import type { Coordinate, PlannedRoute } from './domain'
import { rideTestRoute } from '../../test-fixtures/ride-route'
import { plannedRouteSchema } from './route-schema'

const coordinates: Coordinate[] = Array.from({ length: 21 }, (_, i) => [7.44 + i * .001, 46.95])
const route: PlannedRoute = { ...rideTestRoute, geometry: { type: 'LineString', coordinates }, waypoints: [{ id: 'a', kind: 'start', label: 'Bern', coordinate: coordinates[0] }, { id: 'b', kind: 'end', label: 'Ziel', coordinate: coordinates.at(-1)! }], metrics: { ...rideTestRoute.metrics, surfaceAnalyzed: false } }
const poi: SupplyPoi = { id: 'node/123', category: 'water', name: 'Testbrunnen', coordinate: [7.45, 46.951], openingHours: null, drinkingWater: 'yes', access: null, sourceUpdatedAt: null, offsetM: 100, alongKm: .7 }
function legFor(prepared: ReturnType<typeof prepareSupplyStop>) { return { ...rideTestRoute, geometry: { type: 'LineString' as const, coordinates: [prepared.legPoints[0].coordinate, poi.coordinate, prepared.legPoints.at(-1)!.coordinate] }, metrics: { ...rideTestRoute.metrics, elevationProfile: [510, 520, 515] } } }

describe('supply stop geometry', () => {
  it('projects onto segments, not just sparse vertices', () => {
    expect(projectOnRoute([[7.44, 46.95], [7.46, 46.95]], [7.45, 46.95])).toMatchObject({ offsetM: 0, segment: 1 })
  })
  it('keeps all original coordinates outside the small replacement window and validates the complete result', () => {
    const prepared = prepareSupplyStop(route, poi, 'de')
    const result = spliceSupplyStop(route, poi, 'de', legFor(prepared), prepared)
    expect(result.route.geometry.coordinates.slice(0, prepared.from)).toEqual(coordinates.slice(0, prepared.from))
    expect(result.route.geometry.coordinates.slice(-coordinates.length + prepared.to + 1)).toEqual(coordinates.slice(prepared.to + 1))
    expect(result.route.waypoints.map((p) => p.label)).toEqual(['Bern', 'Testbrunnen', 'Ziel'])
    expect(result.route.id).toBe(route.id)
    expect(result.route.metrics.surfaceAnalyzed).toBe(false)
    expect(result.addedKm).toBeGreaterThan(0)
    expect(plannedRouteSchema.safeParse(result.route).success).toBe(true)
    expect(route.waypoints).toHaveLength(2)
  })
  it('rejects distant places, preview routing, missed POIs and disconnected joins', () => {
    expect(() => prepareSupplyStop(route, { ...poi, coordinate: [8, 47] }, 'de')).toThrow('STOP_NOT_POSSIBLE')
    const prepared = prepareSupplyStop(route, poi, 'de'), leg = legFor(prepared)
    expect(() => spliceSupplyStop(route, poi, 'de', { ...leg, metrics: { ...leg.metrics, confidence: 'preview' } }, prepared)).toThrow('STOP_NOT_REACHED')
    expect(() => spliceSupplyStop(route, poi, 'de', { ...leg, geometry: { type: 'LineString', coordinates: [[7, 47], poi.coordinate, prepared.legPoints.at(-1)!.coordinate] } }, prepared)).toThrow('STOP_NOT_REACHED')
    expect(() => spliceSupplyStop(route, poi, 'de', { ...leg, geometry: { type: 'LineString', coordinates: [prepared.legPoints[0].coordinate, [7.45, 46.96], prepared.legPoints.at(-1)!.coordinate] } }, prepared)).toThrow('STOP_NOT_REACHED')
  })
  it('keeps unavailable elevation unknown and names partially rerouted imports honestly', () => {
    const imported = { ...route, provenance: { ...route.provenance, routingEngine: 'GPX Import' }, metrics: { ...route.metrics, confidence: 'preview' as const, elevationAnalyzed: false } }
    const prepared = prepareSupplyStop(imported, poi, 'de'), result = spliceSupplyStop(imported, poi, 'de', legFor(prepared), prepared)
    expect(result.route.metrics.elevationAnalyzed).toBe(false)
    expect(result.route.metrics.elevationProfile).toEqual([])
    expect(result.route.provenance.routingEngine).toBe('GPX + Zwischenstopp')
    expect(result.route.provenance.dataUpdatedAt).toBeNull()
  })
  it('keeps existing via and generated anchors inside the detour and respects the waypoint limit', () => {
    const via = { id: 'via', label: 'Vorheriger Punkt', coordinate: coordinates[9], kind: 'via' as const }
    const prepared = prepareSupplyStop({ ...route, waypoints: [route.waypoints[0], via, route.waypoints[1]] }, poi, 'de')
    expect(prepared.legPoints.some((p) => p.id === 'via')).toBe(true)
    expect(prepared.waypoints.map((p) => p.id).indexOf('via')).toBeLessThan(prepared.waypoints.findIndex((p) => p.id.startsWith('supply-')))
    expect(() => prepareSupplyStop({ ...route, waypoints: Array.from({ length: 20 }, () => via) }, poi, 'de')).toThrow('STOP_NOT_POSSIBLE')
  })
})
