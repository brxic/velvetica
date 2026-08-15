import type { BikeProfile, Coordinate, PlannedRoute, PlanningRequest } from './domain'

const speed: Record<BikeProfile, number> = { road: 25, gravel: 20, touring: 18, city: 17 }
const asphalt: Record<BikeProfile, number> = { road: 96, gravel: 62, touring: 84, city: 91 }

function destination(origin: Coordinate, distanceKm: number, bearingDeg: number): Coordinate {
  const radius = 6371
  const angular = distanceKm / radius
  const bearing = bearingDeg * Math.PI / 180
  const lat1 = origin[1] * Math.PI / 180
  const lon1 = origin[0] * Math.PI / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing))
  const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2))
  return [lon2 * 180 / Math.PI, lat2 * 180 / Math.PI]
}

function haversine(a: Coordinate, b: Coordinate) {
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(b[1] - a[1]); const dLon = toRad(b[0] - a[0])
  const lat1 = toRad(a[1]); const lat2 = toRad(b[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function createRoundTrip(start: Coordinate, targetDistanceKm: number): Coordinate[] {
  // The chosen five-point loop has a circumference of roughly 6.44 radii.
  const radius = targetDistanceKm / 6.44
  const points: Coordinate[] = [start]
  for (const bearing of [35, 100, 170, 235, 305]) points.push(destination(start, radius, bearing))
  points.push(start)
  return points
}

export function planPreviewRoute(request: PlanningRequest): PlannedRoute {
  const start = request.waypoints.find((point) => point.kind === 'start')
  if (!start) throw new Error('NO_START')

  let coordinates: Coordinate[]
  if (request.mode === 'round-trip') {
    coordinates = createRoundTrip(start.coordinate, request.targetDistanceKm)
  } else {
    const end = request.waypoints.find((point) => point.kind === 'end')
    coordinates = [start.coordinate, ...(request.waypoints.filter((p) => p.kind === 'via').map((p) => p.coordinate)), end?.coordinate ?? destination(start.coordinate, request.targetDistanceKm, 75)]
  }
  const distanceKm = coordinates.slice(1).reduce((sum, point, index) => sum + haversine(coordinates[index], point), 0)
  const climbingFactor = request.preferences.climbing === 'avoid' ? .62 : request.preferences.climbing === 'challenge' ? 1.45 : 1
  const elevationGainM = Math.round(distanceKm * (request.profile === 'road' ? 8.2 : request.profile === 'gravel' ? 10.4 : 6.3) * climbingFactor)
  const surfaceAdjustment = request.preferences.surface === 'mostly-paved' ? 4 : request.preferences.surface === 'unpaved-friendly' ? -20 : 0
  const elevationProfile = Array.from({ length: 48 }, (_, index) => Math.round(410 + Math.sin(index / 4.2) * 65 * climbingFactor + Math.sin(index / 1.9) * 18 + index * (request.mode === 'round-trip' ? 0 : 1.4)))
  const createdAt = new Date().toISOString()

  return {
    id: crypto.randomUUID(), name: `Velvetia ${request.mode === 'round-trip' ? (request.locale === 'de' ? 'Rundtour' : 'Round trip') : 'Route'}`,
    createdAt, profile: request.profile, mode: request.mode,
    geometry: { type: 'LineString', coordinates }, waypoints: request.waypoints,
    metrics: {
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMinutes: Math.round(distanceKm / speed[request.profile] * 60),
      elevationGainM, elevationLossM: request.mode === 'round-trip' ? elevationGainM : Math.round(elevationGainM * .8),
      asphaltPercent: Math.max(25, Math.min(100, asphalt[request.profile] + surfaceAdjustment)), cyclewayPercent: request.profile === 'city' ? 58 : 34, confidence: 'preview', elevationProfile,
    },
    warnings: [request.locale === 'de' ? 'Preview-Geometrie folgt noch nicht dem realen Wegenetz.' : 'Preview geometry does not yet follow the real road network.'],
    provenance: { routingEngine: 'Velvetia Preview', primaryDataSource: request.locale === 'de' ? 'Synthetische Vorschaugeometrie' : 'Synthetic preview geometry', graphVersion: 'preview-v1', dataUpdatedAt: createdAt, analyzedAt: createdAt, regionId: 'ch', confidence: 'low' },
  }
}
