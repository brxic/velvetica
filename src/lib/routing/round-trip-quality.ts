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
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine))
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

function segmentKey(a: Coordinate, b: Coordinate) {
  const first = `${a[0].toFixed(5)},${a[1].toFixed(5)}`
  const second = `${b[0].toFixed(5)},${b[1].toFixed(5)}`
  return first < second ? `${first}|${second}` : `${second}|${first}`
}

function repeatedDistanceShare(coordinates: Coordinate[]) {
  const seen = new Set<string>()
  let total = 0
  let repeated = 0
  for (let index = 1; index < coordinates.length; index++) {
    const length = distanceKm(coordinates[index - 1], coordinates[index])
    if (length <= 0) continue
    total += length
    const key = segmentKey(coordinates[index - 1], coordinates[index])
    if (seen.has(key)) repeated += length
    else seen.add(key)
  }
  return total ? repeated / total : 1
}

export function evaluateRoundTrip(
  coordinates: Coordinate[],
  origin: Coordinate,
  actualDistanceKm: number,
  targetDistanceKm: number,
): RouteQuality {
  if (coordinates.length < 3 || targetDistanceKm <= 0) {
    return { score: Number.POSITIVE_INFINITY, distanceDeviation: 1, repeatedShare: 1, radialExcess: 1, acceptable: false }
  }

  const distanceDeviation = Math.abs(actualDistanceKm - targetDistanceKm) / targetDistanceKm
  const repeatedShare = repeatedDistanceShare(coordinates)
  const maximumRadius = coordinates.reduce((maximum, coordinate) => Math.max(maximum, distanceKm(origin, coordinate)), 0)
  const allowedRadius = Math.max(3, targetDistanceKm * .42)
  const radialExcess = Math.max(0, maximumRadius / allowedRadius - 1)
  const score = distanceDeviation * 55 + repeatedShare * 120 + radialExcess * 70
  const acceptable = distanceDeviation <= .18 && repeatedShare <= .16 && radialExcess <= .12

  return { score: Math.round(score * 100) / 100, distanceDeviation, repeatedShare, radialExcess, acceptable }
}
