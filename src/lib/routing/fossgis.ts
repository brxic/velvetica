import type { Coordinate, PlannedRoute, PlanningRequest } from '@/lib/domain'
import { createRouteName } from '@/lib/route-name'
import type { RoutingProvider } from './provider'
import { createRoundTripSeeds, evaluateRoundTrip } from './round-trip-quality'

type OsrmRoute = { distance: number; duration: number; geometry: GeoJSON.LineString }
type OsrmResponse = { code?: string; routes?: OsrmRoute[]; message?: string }
type ProfilePoint = { alts?: { COMB?: number; DTM2?: number; DTM25?: number } }

let nextRequestAt = 0

async function respectPublicRateLimit() {
  const wait = Math.max(0, nextRequestAt - Date.now())
  nextRequestAt = Math.max(Date.now(), nextRequestAt) + 1_050
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
}

export function wgs84ToLv95([longitude, latitude]: Coordinate): Coordinate {
  const latitudeAux = (latitude * 3600 - 169028.66) / 10000
  const longitudeAux = (longitude * 3600 - 26782.5) / 10000
  const easting = 2600072.37 + 211455.93 * longitudeAux - 10938.51 * longitudeAux * latitudeAux - .36 * longitudeAux * latitudeAux ** 2 - 44.54 * longitudeAux ** 3
  const northing = 1200147.07 + 308807.95 * latitudeAux + 3745.25 * longitudeAux ** 2 + 76.63 * latitudeAux ** 2 - 194.56 * longitudeAux ** 2 * latitudeAux + 119.79 * latitudeAux ** 3
  return [Math.round(easting * 100) / 100, Math.round(northing * 100) / 100]
}

async function fetchElevationProfile(coordinates: Coordinate[]) {
  const stride = Math.max(1, Math.ceil(coordinates.length / 400))
  const sampled = coordinates.filter((_, index) => index % stride === 0)
  if (sampled.at(-1) !== coordinates.at(-1)) sampled.push(coordinates.at(-1)!)
  const geometry: GeoJSON.LineString = { type: 'LineString', coordinates: sampled.map(wgs84ToLv95) }
  try {
    const body = new URLSearchParams({ geom: JSON.stringify(geometry), sr: '2056', nb_points: '240', offset: '2', distinct_points: 'True' })
    const response = await fetch('https://api3.geo.admin.ch/rest/services/profile.json', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Velvetia/0.1 (https://github.com/brxic/velvetica)' }, body, signal: AbortSignal.timeout(12_000) })
    if (!response.ok) throw new Error(`SWISSTOPO_PROFILE_${response.status}`)
    const points = await response.json() as ProfilePoint[]
    const profile = points.map((point) => point.alts?.COMB ?? point.alts?.DTM2 ?? point.alts?.DTM25).filter((height): height is number => Number.isFinite(height))
    let gain = 0; let loss = 0
    for (let index = 1; index < profile.length; index++) {
      const delta = profile[index] - profile[index - 1]
      if (Math.abs(delta) > 80) continue
      if (delta > 0) gain += delta; else loss -= delta
    }
    return { profile, gain: Math.round(gain), loss: Math.round(loss) }
  } catch { return { profile: [], gain: 0, loss: 0 } }
}

export class FossgisBikeProvider implements RoutingProvider {
  readonly id = 'fossgis' as const
  constructor(private readonly baseUrl = 'https://routing.openstreetmap.de/routed-bike') {}

  private async route(coordinates: Coordinate[]) {
    await respectPublicRateLimit()
    const locations = coordinates.map(([longitude, latitude]) => `${longitude.toFixed(6)},${latitude.toFixed(6)}`).join(';')
    const url = `${this.baseUrl.replace(/\/$/, '')}/route/v1/driving/${locations}?overview=full&geometries=geojson&steps=false&continue_straight=true`
    const response = await fetch(url, { headers: { 'User-Agent': 'Velvetia/0.1 (https://github.com/brxic/velvetica)', 'Accept': 'application/json' }, signal: AbortSignal.timeout(25_000) })
    if (!response.ok) throw new Error(`FOSSGIS_HTTP_${response.status}`)
    const result = await response.json() as OsrmResponse
    const route = result.routes?.[0]
    if (result.code !== 'Ok' || !route?.geometry.coordinates?.length) throw new Error(result.message ?? 'FOSSGIS_EMPTY_ROUTE')
    return route
  }

  async plan(request: PlanningRequest): Promise<PlannedRoute> {
    const explicit = request.waypoints.map((point) => point.coordinate)
    let routed: OsrmRoute
    let generatedWaypoints: PlanningRequest['waypoints'] = []
    let qualityWarning: string[] = []
    if (request.mode === 'round-trip' && explicit.length === 1) {
      const routeSeed = async (scale: number) => {
        const seed = createRoundTripSeeds(explicit[0], request.targetDistanceKm, scale)[0]
        const anchors = seed.locations.map((location) => [location.lon, location.lat] as Coordinate)
        return { anchors, route: await this.route([explicit[0], ...anchors, explicit[0]]) }
      }
      let selected = await routeSeed(1)
      const firstDistanceKm = selected.route.distance / 1000
      if (Math.abs(firstDistanceKm - request.targetDistanceKm) / request.targetDistanceKm > .15) {
        const correction = Math.max(.65, Math.min(1.35, request.targetDistanceKm / Math.max(1, firstDistanceKm)))
        const corrected = await routeSeed(correction)
        if (Math.abs(corrected.route.distance / 1000 - request.targetDistanceKm) < Math.abs(firstDistanceKm - request.targetDistanceKm)) selected = corrected
      }
      const anchors = selected.anchors
      routed = selected.route
      const quality = evaluateRoundTrip(routed.geometry.coordinates as Coordinate[], explicit[0], routed.distance / 1000, request.targetDistanceKm)
      if (!quality.acceptable) qualityWarning = [request.locale === 'de' ? 'Die Rundtour weicht von der Wunschdistanz ab. Setze einen Via-Punkt, um den Verlauf anzupassen.' : 'The round trip differs from the target distance. Add a via point to adjust its shape.']
      generatedWaypoints = anchors.map((coordinate, index) => ({ id: `generated-fossgis-${index}`, coordinate, label: `Generated anchor ${index + 1}`, kind: 'generated' }))
    } else {
      const locations = request.mode === 'round-trip' ? [...explicit, explicit[0]] : explicit
      routed = await this.route(locations)
    }
    const coordinates = routed.geometry.coordinates as Coordinate[]
    const elevation = await fetchElevationProfile(coordinates)
    const now = new Date().toISOString()
    const de = request.locale === 'de'
    return {
      id: crypto.randomUUID(), name: createRouteName(request.locale, request.profile, request.mode, request.waypoints), createdAt: now, updatedAt: now,
      profile: request.profile, mode: request.mode, geometry: routed.geometry, waypoints: [...request.waypoints, ...generatedWaypoints],
      metrics: { distanceKm: Math.round(routed.distance / 100) / 10, durationMinutes: Math.max(1, Math.round(routed.duration / 60)), elevationGainM: elevation.gain, elevationLossM: elevation.loss, asphaltPercent: 0, cyclewayPercent: 0, confidence: 'verified', elevationProfile: elevation.profile },
      warnings: [...qualityWarning, de ? 'Untergrund und Radweganteil sind bei diesem Router nicht analysiert.' : 'Surface and cycleway share are not analysed by this router.', de ? 'Der öffentliche Fallback verwendet ein allgemeines Fahrradprofil; die erweiterten Fahrradwünsche gelten vollständig mit Valhalla.' : 'The public fallback uses a general bicycle profile; advanced bicycle preferences apply fully with Valhalla.'],
      provenance: { routingEngine: 'FOSSGIS OSRM Bike', primaryDataSource: 'OpenStreetMap · swisstopo elevation', graphVersion: 'FOSSGIS rolling OSM graph', dataUpdatedAt: now, analyzedAt: now, regionId: 'ch', confidence: elevation.profile.length ? 'medium' : 'low' },
    }
  }
}
