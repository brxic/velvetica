import type { Coordinate, PlanningRequest } from '@/lib/domain'
import { distanceKm } from './round-trip-quality'

/** Reject broken provider output, never "repair" a road route by cutting it
 * into straight lines. User-selected via points are intentionally preserved. */
export function validateRoutedGeometry(coordinates: Coordinate[], reportedKm: number, request: PlanningRequest) {
  if (coordinates.length < 2 || coordinates.length > 20_000 || !Number.isFinite(reportedKm) || reportedKm <= 0 || !coordinates.every((point) => point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)) throw new Error('ROUTE_INVALID_GEOMETRY')
  const start = request.waypoints.find((point) => point.kind === 'start')!
  const end = request.mode === 'round-trip' ? start : request.waypoints.find((point) => point.kind === 'end')!
  if (distanceKm(start.coordinate, coordinates[0]) > .5 || distanceKm(end.coordinate, coordinates.at(-1)!) > .5) throw new Error('ROUTE_ENDPOINT_MISMATCH')
  let length = 0, maximumSegment = 0
  for (let index = 1; index < coordinates.length; index++) {
    const segment = distanceKm(coordinates[index - 1], coordinates[index])
    length += segment; maximumSegment = Math.max(maximumSegment, segment)
  }
  if (length < .01 || length > reportedKm * 4 || reportedKm > length * 4 || (coordinates.length >= 20 && maximumSegment > Math.max(5, length * .4))) throw new Error('ROUTE_GEOMETRY_DISCONTINUITY')
}
