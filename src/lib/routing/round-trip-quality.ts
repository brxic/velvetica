import type { Coordinate } from '@/lib/domain'

export type RoundTripSeed = {
  id: string
  locations: Array<{ lat: number; lon: number; type: 'through' }>
}

export type RouteQuality = {
  score: number
  distanceDeviation: number
  repeatedShare: number
  radialExcess: number
  acceptable: boolean
}

const EARTH_RADIUS_KM = 6371

export function distanceKm(a: Coordinate, b: Coordinate) {
  const latitude1 = a[1] * Math.PI / 180
  const latitude2 = b[1] * Math.PI / 180
  const latitudeDelta = (b[1] - a[1]) * Math.PI / 180
  const longitudeDelta = (b[0] - a[0]) * Math.PI / 180
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))))
}

function destination(origin: Coordinate, distance: number, bearingDegrees: number) {
  const angular = distance / EARTH_RADIUS_KM
  const bearing = bearingDegrees * Math.PI / 180
  const latitude = origin[1] * Math.PI / 180
  const longitude = origin[0] * Math.PI / 180
  const nextLatitude = Math.asin(Math.sin(latitude) * Math.cos(angular) + Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing))
  const nextLongitude = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude), Math.cos(angular) - Math.sin(latitude) * Math.sin(nextLatitude))
  return { lat: nextLatitude * 180 / Math.PI, lon: nextLongitude * 180 / Math.PI, type: 'through' as const }
}

function stableBearing(origin: Coordinate) {
  return Math.abs(Math.round(origin[0] * 10_000 + origin[1] * 1_000)) % 360
}

export function createRoundTripSeeds(origin: Coordinate, targetDistanceKm: number, radiusScale = 1): RoundTripSeed[] {
  const baseBearing = stableBearing(origin)
  const radius = targetDistanceKm / 5.25 * radiusScale
  const rotations = [0, 60, 120, 180, 240, 300]

  return rotations.map((rotation, index) => {
    const bearing = baseBearing + rotation
    return {
      id: `triangle-${index}-${radiusScale.toFixed(2)}`,
      locations: [
        destination(origin, radius, bearing),
        destination(origin, radius * 1.06, bearing + 112),
        destination(origin, radius * .92, bearing + 232),
      ],
    }
  })
}

function repeatedDistanceShare(coordinates: Coordinate[]) {
  // Spatial and direction-aware matching also finds a retraced road when the
  // router uses different vertex spacing in the opposite direction. Nearby
  // parallel roads and isolated crossings must not count as duplicate riding.
  type Visit = { x: number; y: number; dx: number; dy: number; station: number }
  const cells = new Map<string, Visit[]>()
  const origin = coordinates[0]
  const scaleX = 111_195 * Math.cos(origin[1] * Math.PI / 180)
  const geometryKm = coordinates.slice(1).reduce((sum, point, index) => sum + distanceKm(coordinates[index], point), 0)
  const stepKm = Math.max(.025, geometryKm / 25_000)
  let total = 0, repeated = 0
  for (let index = 1; index < coordinates.length; index++) {
    const a = coordinates[index - 1], b = coordinates[index]
    const length = distanceKm(a, b)
    if (length <= 0) continue
    const dx = (b[0] - a[0]) * scaleX, dy = (b[1] - a[1]) * 111_195
    const magnitude = Math.hypot(dx, dy) || 1
    const steps = Math.max(1, Math.ceil(length / stepKm))
    for (let step = 0; step < steps; step++) {
      const fraction = (step + .5) / steps
      const x = (a[0] - origin[0]) * scaleX + dx * fraction
      const y = (a[1] - origin[1]) * 111_195 + dy * fraction
      const station = total + length * fraction
      const cx = Math.floor(x / 25), cy = Math.floor(y / 25)
      let duplicate = false
      for (let ox = -1; ox <= 1 && !duplicate; ox++) for (let oy = -1; oy <= 1 && !duplicate; oy++) {
        duplicate = (cells.get(`${cx + ox},${cy + oy}`) ?? []).some((visit) => station - visit.station > .15 && Math.hypot(x - visit.x, y - visit.y) < 15 && Math.abs(dx / magnitude * visit.dx + dy / magnitude * visit.dy) > .94)
      }
      if (duplicate) repeated += length / steps
      else {
        const key = `${cx},${cy}`
        const visits = cells.get(key) ?? []
        visits.push({ x, y, dx: dx / magnitude, dy: dy / magnitude, station }); cells.set(key, visits)
      }
    }
    total += length
  }
  return total ? repeated / total : 1
}

export function evaluateRoundTrip(
  coordinates: Coordinate[],
  origin: Coordinate,
  actualDistanceKm: number,
  targetDistanceKm: number,
): RouteQuality {
  if (coordinates.length < 3 || coordinates.length > 20_000 || !Number.isFinite(targetDistanceKm) || targetDistanceKm <= 0 || !Number.isFinite(actualDistanceKm) || actualDistanceKm <= 0 || !origin.every(Number.isFinite) || !coordinates.every((point) => point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)) {
    return { score: Number.POSITIVE_INFINITY, distanceDeviation: 1, repeatedShare: 1, radialExcess: 1, acceptable: false }
  }

  const distanceDeviation = Math.abs(actualDistanceKm - targetDistanceKm) / targetDistanceKm
  const repeatedShare = repeatedDistanceShare(coordinates)
  const maximumRadius = coordinates.reduce((maximum, coordinate) => Math.max(maximum, distanceKm(origin, coordinate)), 0)
  const allowedRadius = Math.max(3, targetDistanceKm * .42)
  const radialExcess = Math.max(0, maximumRadius / allowedRadius - 1)
  const score = distanceDeviation * 55 + repeatedShare * 120 + radialExcess * 70
  const closed = distanceKm(coordinates[0], coordinates.at(-1)!) < .5 && distanceKm(coordinates[0], origin) < .5
  const acceptable = closed && distanceDeviation <= .18 && repeatedShare <= .16 && radialExcess <= .12

  return { score: Math.round(score * 100) / 100, distanceDeviation, repeatedShare, radialExcess, acceptable }
}

export function compareRouteQuality(a: RouteQuality, b: RouteQuality) {
  return Number(b.acceptable) - Number(a.acceptable) || a.score - b.score
}

export function usableRoundTrip(quality: RouteQuality) {
  return Number.isFinite(quality.score) && quality.repeatedShare <= .45 && quality.radialExcess <= .5 && quality.distanceDeviation <= .55
}
