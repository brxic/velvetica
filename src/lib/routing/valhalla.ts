import type { BikeProfile, Coordinate, PlannedRoute, PlanningRequest } from '@/lib/domain'
import type { RoutingProvider } from './provider'
import { decodePolyline } from './polyline'

type ValhallaLeg = { shape: string | GeoJSON.LineString }
type ValhallaResponse = { trip?: { summary?: { length?: number; time?: number }; legs?: ValhallaLeg[]; status_message?: string } }

const bicycleType: Record<BikeProfile, 'Road' | 'Cross' | 'Hybrid'> = {
  road: 'Road', gravel: 'Cross', touring: 'Hybrid', city: 'Hybrid',
}

function collectCoordinates(legs: ValhallaLeg[]): Coordinate[] {
  return legs.flatMap((leg, index) => {
    const coordinates = typeof leg.shape === 'string' ? decodePolyline(leg.shape) : leg.shape.coordinates as Coordinate[]
    return index === 0 ? coordinates : coordinates.slice(1)
  })
}

export class ValhallaProvider implements RoutingProvider {
  readonly id = 'valhalla' as const
  constructor(private readonly baseUrl: string) {}

  async plan(request: PlanningRequest): Promise<PlannedRoute> {
    if (request.mode === 'round-trip' && request.waypoints.length < 2) throw new Error('VALHALLA_ROUND_TRIP_REQUIRES_SEEDS')
    const locations = request.waypoints.map((point) => ({ lat: point.coordinate[1], lon: point.coordinate[0], type: point.kind === 'via' ? 'through' : 'break' }))
    if (request.mode === 'round-trip') locations.push({ ...locations[0], type: 'break' })
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/route`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        locations, costing: 'bicycle', units: 'kilometers', language: 'de-DE',
        costing_options: { bicycle: { bicycle_type: bicycleType[request.profile], cycling_speed: request.profile === 'road' ? 25 : request.profile === 'gravel' ? 20 : 18, use_roads: request.profile === 'city' ? .15 : .35, use_hills: request.profile === 'touring' || request.profile === 'city' ? .25 : .5, avoid_bad_surfaces: request.profile === 'road' ? .9 : .35 } },
      }),
    })
    if (!response.ok) throw new Error(`VALHALLA_HTTP_${response.status}`)
    const result = await response.json() as ValhallaResponse
    const legs = result.trip?.legs ?? []; const coordinates = collectCoordinates(legs)
    if (coordinates.length < 2) throw new Error(result.trip?.status_message ?? 'VALHALLA_EMPTY_ROUTE')
    const distanceKm = result.trip?.summary?.length ?? 0
    return {
      id: crypto.randomUUID(), name: request.mode === 'round-trip' ? 'Velvetia Rundtour' : 'Velvetia Route', createdAt: new Date().toISOString(),
      profile: request.profile, mode: request.mode, geometry: { type: 'LineString', coordinates }, waypoints: request.waypoints,
      metrics: { distanceKm: Math.round(distanceKm * 10) / 10, durationMinutes: Math.round((result.trip?.summary?.time ?? 0) / 60), elevationGainM: 0, elevationLossM: 0, asphaltPercent: 0, cyclewayPercent: 0, confidence: 'verified' },
      warnings: ['Höhen- und Oberflächenanalyse folgt nach dem Routinggraph-Spike.'],
    }
  }
}

