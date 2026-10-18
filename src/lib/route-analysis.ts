import type { Coordinate, PlannedRoute } from './domain'
import { distanceKm } from './routing/round-trip-quality'

export type RouteAnalysisSample = {
  index: number
  coordinate: Coordinate
  distanceKm: number
  elevationM: number
  gradePercent: number
  color: string
  lineProgress: number
}

export type RouteClimb = {
  startIndex: number
  endIndex: number
  distanceKm: number
  gainM: number
  averageGradePercent: number
  maximumGradePercent: number
}

export type RouteAnalysis = { samples: RouteAnalysisSample[]; climbs: RouteClimb[] }

export function gradeColor(grade: number) {
  if (grade <= 2) return '#22a559'
  if (grade <= 4) return '#82b927'
  if (grade <= 6) return '#d7b814'
  if (grade <= 9) return '#f28c18'
  if (grade <= 12) return '#e94b22'
  return '#c91524'
}

export function cumulativeDistances(coordinates: Coordinate[]) {
  const distances = [0]
  for (let index = 1; index < coordinates.length; index++) distances.push(distances[index - 1] + distanceKm(coordinates[index - 1], coordinates[index]))
  return distances
}

// MapLibre line-progress uses Web Mercator length, not GPS point count or ground distance.
function mercatorDistances(coordinates: Coordinate[]) {
  const projected = coordinates.map(([lon, lat]) => [lon / 360, Math.log(Math.tan(Math.PI / 4 + Math.max(-85.051129, Math.min(85.051129, lat)) * Math.PI / 360)) / (2 * Math.PI)])
  const distances = [0]
  for (let index = 1; index < projected.length; index++) distances.push(distances[index - 1] + Math.hypot(projected[index][0] - projected[index - 1][0], projected[index][1] - projected[index - 1][1]))
  return distances
}

export function nearestSampleIndex(samples: RouteAnalysisSample[], distance: number) {
  let low = 0; let high = samples.length - 1
  while (low < high) { const middle = Math.floor((low + high) / 2); if (samples[middle].distanceKm < distance) low = middle + 1; else high = middle }
  return low > 0 && Math.abs(samples[low - 1].distanceKm - distance) <= Math.abs(samples[low].distanceKm - distance) ? low - 1 : low
}

function findWindowIndex(distances: number[], origin: number, direction: -1 | 1, targetKm: number) {
  let index = origin
  while (index + direction >= 0 && index + direction < distances.length) {
    index += direction
    if (Math.abs(distances[index] - distances[origin]) >= targetKm) break
  }
  return index
}

function detectClimbs(samples: RouteAnalysisSample[]) {
  const climbs: RouteClimb[] = []
  let start: number | null = null
  for (let index = 0; index <= samples.length; index++) {
    const climbing = index < samples.length && samples[index].gradePercent >= 3
    if (climbing && start === null) start = index
    if ((!climbing || index === samples.length) && start !== null) {
      const end = Math.max(start, index - 1)
      const distance = samples[end].distanceKm - samples[start].distanceKm
      const gain = samples.slice(start + 1, end + 1).reduce((sum, sample, offset) => sum + Math.max(0, sample.elevationM - samples[start! + offset].elevationM), 0)
      if (distance >= .5 && gain >= 30) {
        climbs.push({ startIndex: start, endIndex: end, distanceKm: Math.round(distance * 10) / 10, gainM: Math.round(gain), averageGradePercent: Math.round(gain / (distance * 1000) * 1000) / 10, maximumGradePercent: Math.max(...samples.slice(start, end + 1).map((sample) => sample.gradePercent)) })
      }
      start = null
    }
  }
  return climbs
}

export function analyzeRoute(route: Pick<PlannedRoute, 'geometry' | 'metrics' | 'provenance'>): RouteAnalysis {
  const coordinates = route.geometry.coordinates as Coordinate[]
  const profile = route.metrics.elevationProfile
  if (coordinates.length < 2 || profile.length < 2 || route.metrics.elevationAnalyzed === false) return { samples: [], climbs: [] }
  const distances = cumulativeDistances(coordinates)
  const projected = mercatorDistances(coordinates)
  const totalProjected = projected.at(-1) ?? 0
  // Legacy profiles were sampled by geometry index. Keep that association, including
  // Valhalla's old stride sampling and its explicitly appended final coordinate.
  const stride = Math.max(1, Math.ceil(coordinates.length / 120))
  const legacyIndices = coordinates.map((_, index) => index).filter((index) => index % stride === 0)
  if (legacyIndices.at(-1) !== coordinates.length - 1) legacyIndices.push(coordinates.length - 1)
  const totalDistance = distances.at(-1) ?? 0
  const profileDistances = route.metrics.elevationDistancesKm ?? (route.provenance.routingEngine === 'FOSSGIS OSRM Bike' ? profile.map((_, index) => index / (profile.length - 1) * totalDistance) : profile.length === coordinates.length ? distances : route.provenance.routingEngine.startsWith('Valhalla') && legacyIndices.length === profile.length ? legacyIndices.map((index) => distances[index]) : profile.map((_, index) => {
    const position = index / (profile.length - 1) * (coordinates.length - 1)
    const lower = Math.floor(position); const upper = Math.ceil(position)
    return distances[lower] + (distances[upper] - distances[lower]) * (position - lower)
  }))
  // Preserve elevation peaks between geometry vertices instead of throwing away
  // the denser swisstopo profile. Both views share these exact distance stations.
  const stations = [...new Set([...distances, ...profileDistances.map((distance) => Math.max(0, Math.min(totalDistance, distance)))])].sort((a, b) => a - b)
  let upper = 0
  const elevations = stations.map((distance) => {
    while (upper < profileDistances.length - 1 && profileDistances[upper] < distance) upper++
    const lower = Math.max(0, upper - 1)
    const span = profileDistances[upper] - profileDistances[lower]
    const fraction = span > 0 ? Math.max(0, Math.min(1, (distance - profileDistances[lower]) / span)) : 0
    return profile[lower] + (profile[upper] - profile[lower]) * fraction
  })
  let geometryUpper = 0
  const samples = stations.map((distance, index) => {
    while (geometryUpper < distances.length - 1 && distances[geometryUpper] < distance) geometryUpper++
    const lower = Math.max(0, geometryUpper - 1)
    const span = distances[geometryUpper] - distances[lower]
    const fraction = span > 0 ? (distance - distances[lower]) / span : 0
    const coordinate: Coordinate = [coordinates[lower][0] + (coordinates[geometryUpper][0] - coordinates[lower][0]) * fraction, coordinates[lower][1] + (coordinates[geometryUpper][1] - coordinates[lower][1]) * fraction]
    const progress = projected[lower] + (projected[geometryUpper] - projected[lower]) * fraction
    const before = findWindowIndex(stations, index, -1, .075)
    const after = findWindowIndex(stations, index, 1, .075)
    const runM = (stations[after] - stations[before]) * 1000
    const grade = runM >= 20 ? (elevations[after] - elevations[before]) / runM * 100 : 0
    const gradePercent = Math.round(Math.max(-25, Math.min(25, grade)) * 10) / 10
    return { index, coordinate, distanceKm: distance, elevationM: Math.round(elevations[index]), gradePercent, color: gradeColor(gradePercent), lineProgress: totalProjected > 0 ? progress / totalProjected : 0 }
  })
  return { samples, climbs: detectClimbs(samples) }
}

export function analysisSegments(analysis: RouteAnalysis): GeoJSON.FeatureCollection<GeoJSON.LineString, { grade: number; index: number }> {
  return { type: 'FeatureCollection', features: analysis.samples.slice(1).map((sample, index) => ({ type: 'Feature', properties: { grade: sample.gradePercent, index: sample.index }, geometry: { type: 'LineString', coordinates: [analysis.samples[index].coordinate, sample.coordinate] } })) }
}

export function gradeGradientStops(analysis: RouteAnalysis, maximumStops = 96) {
  if (!analysis.samples.length) return [0, '#e00112', 1, '#e00112'] as Array<number | string>
  const stride = Math.max(1, Math.ceil(analysis.samples.length / maximumStops))
  const selected = analysis.samples.filter((_, index) => index % stride === 0)
  if (selected.at(-1) !== analysis.samples.at(-1)) selected.push(analysis.samples.at(-1)!)
  const unique = selected.filter((sample, index) => index === selected.length - 1 || sample.lineProgress < selected[index + 1].lineProgress)
  if (unique.length < 2) return [0, unique[0]?.color ?? '#e00112', 1, unique[0]?.color ?? '#e00112'] as Array<number | string>
  return unique.flatMap((sample) => [sample.lineProgress, sample.color])
}
