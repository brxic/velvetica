import type { BikeProfile, Coordinate, Locale, PlannedRoute, PlanningRequest } from '@/lib/domain'
import type { RoutingProvider } from './provider'
import { decodePolyline } from './polyline'
import { createRoundTripSeeds, evaluateRoundTrip, type RouteQuality } from './round-trip-quality'
import { createRouteName } from '@/lib/route-name'

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

type TraceEdge = { length?: number; surface?: string; use?: string; cycle_lane?: string; tunnel?: boolean; dismount?: boolean }

export function summarizeTraceEdges(edges: TraceEdge[], locale: Locale = 'de') {
  const total = edges.reduce((sum, edge) => sum + (edge.length ?? 0), 0)
  if (!total) throw new Error('VALHALLA_ATTRIBUTES_EMPTY')
  const paved = new Set(['paved', 'paved_smooth', 'paved_rough'])
  const asphalt = edges.reduce((sum, edge) => sum + (paved.has(edge.surface ?? '') ? edge.length ?? 0 : 0), 0)
  const cycleway = edges.reduce((sum, edge) => sum + (edge.use === 'cycleway' || (edge.cycle_lane && edge.cycle_lane !== 'none') ? edge.length ?? 0 : 0), 0)
  const tunnel = edges.reduce((sum, edge) => sum + (edge.tunnel ? edge.length ?? 0 : 0), 0)
  const dismount = edges.reduce((sum, edge) => sum + (edge.dismount || edge.use === 'steps' ? edge.length ?? 0 : 0), 0)
  const asphaltPercent = Math.round(asphalt / total * 100)
  const warnings: string[] = []
  if (100 - asphaltPercent >= 10) warnings.push(locale === 'de' ? `${100 - asphaltPercent} % der Route verlaufen laut OSM auf nicht befestigtem oder unbekanntem Untergrund.` : `${100 - asphaltPercent}% of the route uses unpaved or unknown surfaces according to OSM.`)
  if (tunnel >= .1) warnings.push(locale === 'de' ? `${tunnel.toFixed(1)} km verlaufen durch Tunnel. Beleuchtung und aktuelle Befahrbarkeit vor Ort prüfen.` : `${tunnel.toFixed(1)} km run through tunnels. Check lighting and current access locally.`)
  if (dismount >= .02) {
    const dismountDistance = dismount < .1 ? `${Math.round(dismount * 1000)} m` : `${dismount.toFixed(1)} km`
    warnings.push(locale === 'de' ? `${dismountDistance} sind als Schiebe- oder Treppenabschnitt erfasst.` : `${dismountDistance} are tagged as dismount or stair sections.`)
  }
  return { asphaltPercent, cyclewayPercent: Math.round(cycleway / total * 100), analyzed: true, warnings }
}

async function fetchRouteAttributes(baseUrl: string, coordinates: Coordinate[], locale: Locale) {
  const stride = Math.max(1, Math.ceil(coordinates.length / 120))
  const sampled = coordinates.filter((_, index) => index % stride === 0)
  if (sampled.at(-1) !== coordinates.at(-1)) sampled.push(coordinates.at(-1)!)
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/trace_attributes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        shape: sampled.map(([lon, lat]) => ({ lat, lon })), costing: 'bicycle', shape_match: 'walk_or_snap',
        filters: { action: 'include', attributes: ['edge.length', 'edge.surface', 'edge.use', 'edge.cycle_lane', 'edge.tunnel', 'edge.dismount'] },
      }),
    })
    if (!response.ok) throw new Error('VALHALLA_ATTRIBUTES_FAILED')
    const data = await response.json() as { edges?: TraceEdge[] }
    return summarizeTraceEdges(data.edges ?? [], locale)
  } catch { return { asphaltPercent: 0, cyclewayPercent: 0, analyzed: false, warnings: [locale === 'de' ? 'Oberflächen- und Wegattribute konnten für diese Route nicht ausgewertet werden.' : 'Surface and path attributes could not be analyzed for this route.'] } }
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
    const bicycleOptions = {
      bicycle_type: bicycleType[request.profile],
      cycling_speed: request.profile === 'road' ? 25 : request.profile === 'gravel' ? 20 : 18,
      use_roads: request.preferences.safety === 'quiet' ? .1 : request.preferences.safety === 'direct' ? .6 : .3,
      use_hills: request.preferences.climbing === 'avoid' ? .05 : request.preferences.climbing === 'challenge' ? .8 : .4,
      avoid_bad_surfaces: request.preferences.surface === 'mostly-paved' ? .95 : request.preferences.surface === 'unpaved-friendly' ? .1 : request.profile === 'road' ? .85 : .35,
    }
    const routeCandidate = async (locations: Array<{ lat: number; lon: number; type: 'break' | 'through' }>) => {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/route`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          locations, costing: 'bicycle', units: 'kilometers', language: request.locale === 'de' ? 'de-DE' : 'en-US',
          costing_options: { bicycle: bicycleOptions },
        }),
      })
      if (!response.ok) throw new Error(`VALHALLA_HTTP_${response.status}`)
      const result = await response.json() as ValhallaResponse
      const coordinates = collectCoordinates(result.trip?.legs ?? [])
      if (coordinates.length < 2) throw new Error(result.trip?.status_message ?? 'VALHALLA_EMPTY_ROUTE')
      return { coordinates, distanceKm: result.trip?.summary?.length ?? 0, durationSeconds: result.trip?.summary?.time ?? 0 }
    }

    const explicitLocations = request.waypoints.map((point) => ({ lat: point.coordinate[1], lon: point.coordinate[0], type: point.kind === 'via' || point.kind === 'shaping' || point.kind === 'generated' ? 'through' as const : 'break' as const }))
    let selected: Awaited<ReturnType<typeof routeCandidate>>
    let selectedQuality: RouteQuality | undefined
    let generatedWaypoints: PlanningRequest['waypoints'] = []

    if (request.mode === 'round-trip' && explicitLocations.length === 1) {
      const origin = request.waypoints[0].coordinate
      const originLocation = explicitLocations[0]
      const runSeeds = async (radiusScale: number) => {
        const settled = await Promise.allSettled(createRoundTripSeeds(origin, request.targetDistanceKm, radiusScale).map(async (seed) => {
          const candidate = await routeCandidate([originLocation, ...seed.locations, originLocation])
          return { candidate, seed, quality: evaluateRoundTrip(candidate.coordinates, origin, candidate.distanceKm, request.targetDistanceKm) }
        }))
        return settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      }

      let candidates = await runSeeds(1)
      if (!candidates.length) throw new Error('VALHALLA_NO_ROUND_TRIP_CANDIDATE')
      candidates.sort((a, b) => a.quality.score - b.quality.score)

      if (!candidates[0].quality.acceptable) {
        const correction = Math.max(.72, Math.min(1.28, request.targetDistanceKm / Math.max(1, candidates[0].candidate.distanceKm)))
        const retryScales = [correction, Math.max(.62, correction * .82), Math.min(1.38, correction * 1.18)]
        const retries = await Promise.all(retryScales.map(runSeeds))
        candidates = [...candidates, ...retries.flat()].sort((a, b) => a.quality.score - b.quality.score)
      }

      selected = candidates[0].candidate
      selectedQuality = candidates[0].quality
      generatedWaypoints = candidates[0].seed.locations.map((location, index) => ({
        id: `generated-${candidates[0].seed.id}-${index}`,
        coordinate: [location.lon, location.lat],
        label: `Generated anchor ${index + 1}`,
        kind: 'generated',
      }))
    } else {
      const locations = request.mode === 'round-trip' ? [...explicitLocations, explicitLocations[0]] : explicitLocations
      selected = await routeCandidate(locations)
    }

    const { coordinates, distanceKm, durationSeconds } = selected
    const [elevation, attributes, graph] = await Promise.all([fetchElevation(this.baseUrl, coordinates), fetchRouteAttributes(this.baseUrl, coordinates, request.locale), fetchGraphMetadata(this.baseUrl)])
    const createdAt = new Date().toISOString()
    const qualityWarning = selectedQuality && !selectedQuality.acceptable
      ? [request.locale === 'de' ? 'Die beste verfügbare Rundtour weicht stärker als üblich vom gewünschten Verlauf ab. Prüfe sie vor der Fahrt oder setze einen Via-Punkt.' : 'The best available round trip differs more than usual from the requested shape. Review it before riding or add a via point.']
      : []
    return {
      id: crypto.randomUUID(), name: createRouteName(request.locale, request.profile, request.mode, request.waypoints), createdAt, updatedAt: createdAt,
      profile: request.profile, mode: request.mode, geometry: { type: 'LineString', coordinates }, waypoints: [...request.waypoints, ...generatedWaypoints],
      metrics: { distanceKm: Math.round(distanceKm * 10) / 10, durationMinutes: Math.round(durationSeconds / 60), elevationGainM: elevation.gain, elevationLossM: elevation.loss, asphaltPercent: attributes.asphaltPercent, cyclewayPercent: attributes.cyclewayPercent, confidence: 'verified', elevationProfile: elevation.profile },
      warnings: [...qualityWarning, ...attributes.warnings],
      provenance: { routingEngine: `Valhalla ${graph.graphVersion}`, primaryDataSource: request.locale === 'de' ? 'OpenStreetMap / Geofabrik Schweiz' : 'OpenStreetMap / Geofabrik Switzerland', graphVersion: graph.graphVersion, dataUpdatedAt: graph.dataUpdatedAt, analyzedAt: createdAt, regionId: 'ch', confidence: attributes.analyzed && elevation.profile.length ? 'high' : 'medium' },
    }
  }
}
