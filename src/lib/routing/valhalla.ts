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

function destination(origin: Coordinate, distanceKm: number, bearingDegrees: number) {
  const radiusKm = 6371
  const angular = distanceKm / radiusKm
  const bearing = bearingDegrees * Math.PI / 180
  const latitude = origin[1] * Math.PI / 180
  const longitude = origin[0] * Math.PI / 180
  const nextLatitude = Math.asin(Math.sin(latitude) * Math.cos(angular) + Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing))
  const nextLongitude = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude), Math.cos(angular) - Math.sin(latitude) * Math.sin(nextLatitude))
  return { lat: nextLatitude * 180 / Math.PI, lon: nextLongitude * 180 / Math.PI, type: 'through' as const }
}

async function fetchElevation(baseUrl: string, coordinates: Coordinate[]) {
  const stride = Math.max(1, Math.ceil(coordinates.length / 120))
  const sampled = coordinates.filter((_, index) => index % stride === 0)
  if (sampled.at(-1) !== coordinates.at(-1)) sampled.push(coordinates.at(-1)!)
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/height`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({ shape: sampled.map(([lon, lat]) => ({ lat, lon })) }),
    })
    if (!response.ok) throw new Error('VALHALLA_HEIGHT_FAILED')
    const data = await response.json() as { height?: Array<number | null> }
    const profile = (data.height ?? []).filter((height): height is number => Number.isFinite(height))
    let gain = 0; let loss = 0
    for (let index = 1; index < profile.length; index++) {
      const difference = profile[index] - profile[index - 1]
      if (Math.abs(difference) > 80) continue
      if (difference > 0) gain += difference; else loss -= difference
    }
    return { profile, gain: Math.round(gain), loss: Math.round(loss) }
  } catch { return { profile: [], gain: 0, loss: 0 } }
}

type TraceEdge = { length?: number; surface?: string; use?: string; cycle_lane?: string }

async function fetchRouteAttributes(baseUrl: string, coordinates: Coordinate[]) {
  const stride = Math.max(1, Math.ceil(coordinates.length / 120))
  const sampled = coordinates.filter((_, index) => index % stride === 0)
  if (sampled.at(-1) !== coordinates.at(-1)) sampled.push(coordinates.at(-1)!)
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/trace_attributes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        shape: sampled.map(([lon, lat]) => ({ lat, lon })), costing: 'bicycle', shape_match: 'walk_or_snap',
        filters: { action: 'include', attributes: ['edge.length', 'edge.surface', 'edge.use', 'edge.cycle_lane'] },
      }),
    })
    if (!response.ok) throw new Error('VALHALLA_ATTRIBUTES_FAILED')
    const data = await response.json() as { edges?: TraceEdge[] }
    const edges = data.edges ?? []
    const total = edges.reduce((sum, edge) => sum + (edge.length ?? 0), 0)
    if (!total) throw new Error('VALHALLA_ATTRIBUTES_EMPTY')
    const paved = new Set(['paved', 'paved_smooth', 'paved_rough'])
    const asphalt = edges.reduce((sum, edge) => sum + (paved.has(edge.surface ?? '') ? edge.length ?? 0 : 0), 0)
    const cycleway = edges.reduce((sum, edge) => sum + (edge.use === 'cycleway' || (edge.cycle_lane && edge.cycle_lane !== 'none') ? edge.length ?? 0 : 0), 0)
    return { asphaltPercent: Math.round(asphalt / total * 100), cyclewayPercent: Math.round(cycleway / total * 100), analyzed: true }
  } catch { return { asphaltPercent: 0, cyclewayPercent: 0, analyzed: false } }
}

async function fetchGraphMetadata(baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/status`, { signal: AbortSignal.timeout(3_000) })
    if (!response.ok) throw new Error('VALHALLA_STATUS_FAILED')
    const status = await response.json() as { version?: string; tileset_last_modified?: number }
    return {
      graphVersion: status.version ?? 'unknown',
      dataUpdatedAt: status.tileset_last_modified ? new Date(status.tileset_last_modified * 1000).toISOString() : new Date().toISOString(),
    }
  } catch { return { graphVersion: 'unknown', dataUpdatedAt: new Date().toISOString() } }
}

export class ValhallaProvider implements RoutingProvider {
  readonly id = 'valhalla' as const
  constructor(private readonly baseUrl: string) {}

  async plan(request: PlanningRequest): Promise<PlannedRoute> {
    const locations = request.waypoints.map((point) => ({ lat: point.coordinate[1], lon: point.coordinate[0], type: point.kind === 'via' ? 'through' : 'break' }))
    if (request.mode === 'round-trip' && locations.length === 1) {
      const origin = request.waypoints[0].coordinate
      const radiusKm = request.targetDistanceKm / 4.5
      const bearing = Math.abs(Math.round((origin[0] * 1000 + origin[1] * 100) % 180))
      locations.push(destination(origin, radiusKm, bearing), destination(origin, radiusKm, bearing + 90))
    }
    if (request.mode === 'round-trip') locations.push({ ...locations[0], type: 'break' })
    const bicycleOptions = {
      bicycle_type: bicycleType[request.profile],
      cycling_speed: request.profile === 'road' ? 25 : request.profile === 'gravel' ? 20 : 18,
      use_roads: request.preferences.safety === 'quiet' ? .1 : request.preferences.safety === 'direct' ? .6 : .3,
      use_hills: request.preferences.climbing === 'avoid' ? .05 : request.preferences.climbing === 'challenge' ? .8 : .4,
      avoid_bad_surfaces: request.preferences.surface === 'mostly-paved' ? .95 : request.preferences.surface === 'unpaved-friendly' ? .1 : request.profile === 'road' ? .85 : .35,
    }
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/route`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        locations, costing: 'bicycle', units: 'kilometers', language: 'de-DE',
        costing_options: { bicycle: bicycleOptions },
      }),
    })
    if (!response.ok) throw new Error(`VALHALLA_HTTP_${response.status}`)
    const result = await response.json() as ValhallaResponse
    const legs = result.trip?.legs ?? []; const coordinates = collectCoordinates(legs)
    if (coordinates.length < 2) throw new Error(result.trip?.status_message ?? 'VALHALLA_EMPTY_ROUTE')
    const distanceKm = result.trip?.summary?.length ?? 0
    const [elevation, attributes, graph] = await Promise.all([fetchElevation(this.baseUrl, coordinates), fetchRouteAttributes(this.baseUrl, coordinates), fetchGraphMetadata(this.baseUrl)])
    const createdAt = new Date().toISOString()
    return {
      id: crypto.randomUUID(), name: request.mode === 'round-trip' ? 'Velvetia Rundtour' : 'Velvetia Route', createdAt,
      profile: request.profile, mode: request.mode, geometry: { type: 'LineString', coordinates }, waypoints: request.waypoints,
      metrics: { distanceKm: Math.round(distanceKm * 10) / 10, durationMinutes: Math.round((result.trip?.summary?.time ?? 0) / 60), elevationGainM: elevation.gain, elevationLossM: elevation.loss, asphaltPercent: attributes.asphaltPercent, cyclewayPercent: attributes.cyclewayPercent, confidence: 'verified', elevationProfile: elevation.profile },
      warnings: attributes.analyzed ? [] : ['Oberflächen- und Radweganteile konnten für diese Route nicht ausgewertet werden.'],
      provenance: { routingEngine: `Valhalla ${graph.graphVersion}`, primaryDataSource: 'OpenStreetMap / Geofabrik Schweiz', graphVersion: graph.graphVersion, dataUpdatedAt: graph.dataUpdatedAt, analyzedAt: createdAt, regionId: 'ch', confidence: attributes.analyzed && elevation.profile.length ? 'high' : 'medium' },
    }
  }
}
