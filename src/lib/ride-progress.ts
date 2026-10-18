import type { Coordinate, PlannedRoute } from './domain'
import { analyzeRoute, cumulativeDistances } from './route-analysis'
import { distanceKm } from './routing/round-trip-quality'

export type RideFix = { coordinate: Coordinate; accuracyM: number; timestamp: number; speedMps: number | null }
export type RideProgress = { distanceKm: number; remainingKm: number; offsetM: number; remainingAscentM: number | null; remainingMinutes: number | null; offRoute: boolean; arrived: boolean; timestamp: number }
export type RideTrack = ReturnType<typeof createRideTrack>

export function rideableSource(route: PlannedRoute) {
  return route.metrics.distanceKm > 0 && route.geometry.coordinates.length > 1 && (route.metrics.confidence === 'verified' || route.provenance.routingEngine === 'GPX Import')
}

export function createRideTrack(route: PlannedRoute) {
  const coordinates = route.geometry.coordinates as Coordinate[]
  const distances = cumulativeDistances(coordinates)
  return { coordinates, distances, totalKm: distances.at(-1) ?? 0, durationMinutes: route.metrics.durationMinutes, samples: route.metrics.elevationAnalyzed === false ? [] : analyzeRoute(route).samples }
}

export function usableRideFix(fix: RideFix, previous: RideFix | null, now: number) {
  if (!fix.coordinate.every(Number.isFinite) || Math.abs(fix.coordinate[0]) > 180 || Math.abs(fix.coordinate[1]) > 90 || !Number.isFinite(fix.accuracyM) || fix.accuracyM < 0 || fix.accuracyM > 80 || !Number.isFinite(fix.timestamp) || now - fix.timestamp > 15_000 || fix.timestamp > now + 5_000) return false
  if (previous && (fix.timestamp <= previous.timestamp || distanceKm(previous.coordinate, fix.coordinate) > Math.max(.2, (fix.timestamp - previous.timestamp) / 1000 * .04))) return false
  return true
}

/** Project onto segments, not vertices. Continuity resolves crossings and the
 * shared start/finish of a loop without jumping to the end on the first fix. */
export function locateRidePosition(track: RideTrack, fix: RideFix, previous: RideProgress | null): RideProgress {
  const scaleX = 111_195 * Math.cos(fix.coordinate[1] * Math.PI / 180)
  const scaleY = 111_195
  let bestScore = Infinity, offsetM = Infinity, distance = 0
  const elapsed = previous ? Math.max(0, fix.timestamp - previous.timestamp) / 1000 : 0
  const plausibleJump = Math.max(.15, elapsed * .04)
  for (let index = 1; index < track.coordinates.length; index++) {
    const a = track.coordinates[index - 1], b = track.coordinates[index]
    const ax = (a[0] - fix.coordinate[0]) * scaleX, ay = (a[1] - fix.coordinate[1]) * scaleY
    const dx = (b[0] - a[0]) * scaleX, dy = (b[1] - a[1]) * scaleY
    const fraction = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)))
    const offset = Math.hypot(ax + fraction * dx, ay + fraction * dy)
    const along = track.distances[index - 1] + fraction * (track.distances[index] - track.distances[index - 1])
    const delta = previous ? Math.abs(along - previous.distanceKm) : 0
    const score = offset + (previous ? Math.max(0, delta - plausibleJump) * 2000 + delta * .1 : along * .001)
    if (score < bestScore) { bestScore = score; offsetM = offset; distance = along }
  }
  const offRoute = offsetM > Math.max(40, fix.accuracyM * 2)
  // Never consume route progress while riding away from it.
  if (offRoute) distance = previous?.distanceKm ?? 0
  const remainingKm = Math.max(0, track.totalKm - distance)
  let remainingAscentM: number | null = track.samples.length > 1 ? 0 : null
  for (let index = 1; index < track.samples.length; index++) {
    const a = track.samples[index - 1], b = track.samples[index]
    if (b.distanceKm <= distance) continue
    const gain = b.elevationM - a.elevationM
    const span = b.distanceKm - a.distanceKm
    if (gain > 0 && span > 0 && gain / (span * 1000) <= .4) remainingAscentM! += gain * Math.min(1, (b.distanceKm - distance) / span)
  }
  return { distanceKm: distance, remainingKm, offsetM, offRoute, remainingAscentM: remainingAscentM === null ? null : Math.round(remainingAscentM), remainingMinutes: track.durationMinutes > 0 && track.totalKm > 0 ? Math.round(remainingKm / track.totalKm * track.durationMinutes) : null, arrived: !offRoute && distance > track.totalKm * .85 && remainingKm < .03 && distanceKm(fix.coordinate, track.coordinates.at(-1)!) < .035, timestamp: offRoute ? previous?.timestamp ?? fix.timestamp : fix.timestamp }
}

export function locationAccuracyRing(fix: RideFix): GeoJSON.Feature<GeoJSON.Polygon> {
  const coordinates = Array.from({ length: 49 }, (_, index) => {
    const angle = index / 48 * Math.PI * 2
    return [fix.coordinate[0] + Math.cos(angle) * fix.accuracyM / (111_195 * Math.max(.001, Math.cos(fix.coordinate[1] * Math.PI / 180))), fix.coordinate[1] + Math.sin(angle) * fix.accuracyM / 111_195]
  })
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coordinates] } }
}
