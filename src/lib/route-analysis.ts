import type { Coordinate, PlannedRoute } from './domain'
import { distanceKm } from './routing/round-trip-quality'

export type RouteAnalysisSample = {
  index: number
  coordinate: Coordinate
  distanceKm: number
  elevationM: number
  gradePercent: number
  color: string
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

function elevationAt(profile: number[], coordinateIndex: number, coordinateCount: number) {
  if (profile.length === coordinateCount) return profile[coordinateIndex]
  const position = coordinateIndex / Math.max(1, coordinateCount - 1) * (profile.length - 1)
  const lower = Math.floor(position); const upper = Math.min(profile.length - 1, Math.ceil(position))
  return profile[lower] + (profile[upper] - profile[lower]) * (position - lower)
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

export function analyzeRoute(route: PlannedRoute): RouteAnalysis {
  const coordinates = route.geometry.coordinates as Coordinate[]
  const profile = route.metrics.elevationProfile
  if (coordinates.length < 2 || profile.length < 2) return { samples: [], climbs: [] }
  const distances = [0]
  for (let index = 1; index < coordinates.length; index++) distances.push(distances[index - 1] + distanceKm(coordinates[index - 1], coordinates[index]))
  const elevations = coordinates.map((_, index) => elevationAt(profile, index, coordinates.length))
  const samples = coordinates.map((coordinate, index) => {
    const before = findWindowIndex(distances, index, -1, .075)
    const after = findWindowIndex(distances, index, 1, .075)
    const runM = (distances[after] - distances[before]) * 1000
    const grade = runM >= 20 ? (elevations[after] - elevations[before]) / runM * 100 : 0
    const gradePercent = Math.round(Math.max(-25, Math.min(25, grade)) * 10) / 10
    return { index, coordinate, distanceKm: distances[index], elevationM: Math.round(elevations[index]), gradePercent, color: gradeColor(gradePercent) }
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
  return selected.flatMap((sample) => [sample.index / Math.max(1, analysis.samples.length - 1), sample.color])
}
