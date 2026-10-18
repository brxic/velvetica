import { z } from 'zod'
import type { Coordinate, Locale, PlannedRoute, Waypoint } from './domain'
import { analyzeRoute, cumulativeDistances } from './route-analysis'
import { distanceKm } from './routing/round-trip-quality'

export const supplyCategory = z.enum(['water', 'food', 'shop'])
export type SupplyCategory = z.infer<typeof supplyCategory>
export const supplyPoiSchema = z.object({
  id: z.string().regex(/^(node|way|relation)\/[0-9]+$/), category: supplyCategory,
  name: z.string().max(200), coordinate: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  openingHours: z.string().max(500).nullable(), drinkingWater: z.string().max(30).nullable(), access: z.string().max(50).nullable(),
  sourceUpdatedAt: z.string().datetime().nullable(), offsetM: z.number().nonnegative(), alongKm: z.number().nonnegative(),
})
export type SupplyPoi = z.infer<typeof supplyPoiSchema>
export const supplyResultSchema = z.object({
  pois: z.array(supplyPoiSchema).max(60), truncated: z.boolean(), corridorM: z.literal(500),
  source: z.object({ regionId: z.string(), snapshotAt: z.string().datetime(), importedAt: z.string().datetime() }),
})
export type SupplyResult = z.infer<typeof supplyResultSchema>
export const supplyLabels = { de: { water: 'Trinkwasser', food: 'Cafés & Restaurants', shop: 'Lebensmittel' }, en: { water: 'Drinking water', food: 'Cafés & restaurants', shop: 'Groceries' } }
export function poiName(poi: SupplyPoi, locale: Locale) { return poi.name || supplyLabels[locale][poi.category] }

/** Nearest segment in local metres; never confuse lateral distance with a rideable detour. */
export function projectOnRoute(coordinates: Coordinate[], point: Coordinate) {
  const distances = cumulativeDistances(coordinates)
  let best = { offsetM: Infinity, alongKm: 0, segment: 1 }
  const sx = 111_195 * Math.cos(point[1] * Math.PI / 180)
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1], b = coordinates[i]
    const x = (a[0] - point[0]) * sx, y = (a[1] - point[1]) * 111_195
    const dx = (b[0] - a[0]) * sx, dy = (b[1] - a[1]) * 111_195
    const t = Math.max(0, Math.min(1, -(x * dx + y * dy) / (dx * dx + dy * dy || 1)))
    const offsetM = Math.hypot(x + t * dx, y + t * dy)
    if (offsetM < best.offsetM) best = { offsetM, segment: i, alongKm: distances[i - 1] + t * (distances[i] - distances[i - 1]) }
  }
  return best
}

export function prepareSupplyStop(route: PlannedRoute, poi: SupplyPoi, locale: Locale) {
  const coordinates = route.geometry.coordinates as Coordinate[], distances = cumulativeDistances(coordinates)
  if (!(distances.at(-1)! > 0)) throw new Error('STOP_NOT_POSSIBLE')
  const nearest = projectOnRoute(coordinates, poi.coordinate)
  if (nearest.offsetM > 550 || route.waypoints.length >= 20) throw new Error('STOP_NOT_POSSIBLE')
  let from = nearest.segment - 1, to = nearest.segment
  while (from > 0 && distances[from] > nearest.alongKm - .3) from--
  while (to < coordinates.length - 1 && distances[to] < nearest.alongKm + .3) to++
  // Very sparse imported lines must not cause an unexpectedly large replacement.
  if (distances[to] - distances[from] > 5) throw new Error('STOP_SPARSE_GEOMETRY')
  const stop: Waypoint = { id: `supply-${crypto.randomUUID()}`, kind: 'via', label: poiName(poi, locale), coordinate: poi.coordinate }
  const located = route.waypoints.map((point, index) => ({ point, index, ...projectOnRoute(coordinates, point.coordinate) }))
  const middle = located.filter(({ point, alongKm }) => point.kind !== 'start' && point.kind !== 'end' && alongKm > distances[from] && alongKm < distances[to])
  const legPoints = [...middle.map(({ point, alongKm }) => ({ point: { ...point, kind: 'via' as const }, alongKm })), { point: stop, alongKm: nearest.alongKm }].sort((a, b) => a.alongKm - b.alongKm).map(({ point }) => point)
  const insertion = located.find(({ point, alongKm }) => point.kind !== 'start' && (point.kind === 'end' || alongKm > nearest.alongKm))?.index ?? route.waypoints.length
  const waypoints = [...route.waypoints]; waypoints.splice(insertion, 0, stop)
  return { from, to, distances, waypoints, stop, legPoints: [{ id: 'stop-entry', label: 'Entry', kind: 'start' as const, coordinate: coordinates[from] }, ...legPoints, { id: 'stop-exit', label: 'Exit', kind: 'end' as const, coordinate: coordinates[to] }] }
}

/** Only the replacement window changes; original coordinates outside it are copied verbatim. */
export function spliceSupplyStop(route: PlannedRoute, poi: SupplyPoi, locale: Locale, leg: PlannedRoute, prepared: ReturnType<typeof prepareSupplyStop>) {
  const old = route.geometry.coordinates as Coordinate[], replacement = leg.geometry.coordinates as Coordinate[]
  if (leg.metrics.confidence !== 'verified' || distanceKm(old[prepared.from], replacement[0]) > .025 || distanceKm(old[prepared.to], replacement.at(-1)!) > .025 || prepared.legPoints.some((point) => projectOnRoute(replacement, point.coordinate).offsetM > 100)) throw new Error('STOP_NOT_REACHED')
  const segment = [...replacement]; segment[0] = old[prepared.from]; segment[segment.length - 1] = old[prepared.to]
  const coordinates = [...old.slice(0, prepared.from), ...segment, ...old.slice(prepared.to + 1)]
  if (coordinates.length > 20_000) throw new Error('STOP_TOO_COMPLEX')
  const beforeKm = prepared.distances.at(-1)!, legKm = cumulativeDistances(segment).at(-1)!, removedKm = prepared.distances[prepared.to] - prepared.distances[prepared.from]
  const afterKm = beforeKm - removedKm + legKm
  // A local stop must not replace the surrounding route with a very long excursion.
  if (legKm > removedKm + 20) throw new Error('STOP_EXCESSIVE_DETOUR')
  const oldSamples = analyzeRoute(route).samples, legSamples = analyzeRoute(leg).samples
  const hasElevation = oldSamples.length > 1 && legSamples.length > 1
  const combined = hasElevation ? [
    ...oldSamples.filter((s) => s.distanceKm < prepared.distances[prepared.from]).map((s) => ({ height: s.elevationM, km: s.distanceKm })),
    ...legSamples.map((s) => ({ height: s.elevationM, km: prepared.distances[prepared.from] + s.distanceKm * legKm / (legSamples.at(-1)!.distanceKm || legKm) })),
    ...oldSamples.filter((s) => s.distanceKm > prepared.distances[prepared.to]).map((s) => ({ height: s.elevationM, km: s.distanceKm + legKm - removedKm })),
  ] : []
  const samples = combined.length > 20_000 ? Array.from({ length: 20_000 }, (_, i) => combined[Math.round(i / 19_999 * (combined.length - 1))]) : combined
  let gain = 0, loss = 0
  for (let i = 1; i < samples.length; i++) { const delta = samples[i].height - samples[i - 1].height; gain += Math.max(0, delta); loss += Math.max(0, -delta) }
  const hasSurface = route.metrics.surfaceAnalyzed === true && leg.metrics.surfaceAnalyzed === true
  const weighted = (key: 'asphaltPercent' | 'cyclewayPercent') => Math.round((route.metrics[key] * (beforeKm - removedKm) + leg.metrics[key] * legKm) / afterKm)
  const imported = route.provenance.routingEngine.startsWith('GPX')
  const candidate: PlannedRoute = {
    ...route, geometry: { type: 'LineString', coordinates }, waypoints: prepared.waypoints,
    metrics: { distanceKm: Math.round(afterKm * 10) / 10, durationMinutes: Math.max(1, Math.round(route.metrics.durationMinutes * (1 - removedKm / beforeKm) + leg.metrics.durationMinutes)), elevationGainM: Math.round(gain), elevationLossM: Math.round(loss), asphaltPercent: hasSurface ? weighted('asphaltPercent') : 0, cyclewayPercent: hasSurface ? weighted('cyclewayPercent') : 0, surfaceAnalyzed: hasSurface, elevationAnalyzed: hasElevation, elevationProfile: samples.map((s) => s.height), elevationDistancesKm: samples.map((s) => s.km), confidence: route.metrics.confidence },
    provenance: { ...route.provenance, routingEngine: imported ? 'GPX + Zwischenstopp' : route.provenance.routingEngine, primaryDataSource: `${route.provenance.primaryDataSource}; Stopp: ${leg.provenance.routingEngine}`.slice(0, 200), graphVersion: `${route.provenance.graphVersion}; ${leg.provenance.graphVersion}`.slice(0, 100), analyzedAt: new Date().toISOString(), confidence: 'low', dataUpdatedAt: null },
    warnings: [...new Set([...route.warnings, ...leg.warnings, locale === 'de' ? 'Nur der Abschnitt beim Zwischenstopp wurde neu berechnet. Zugang und Öffnungszeiten vor Ort prüfen.' : 'Only the stop section was recalculated. Check access and opening hours on site.'])].slice(0, 50),
  }
  return { route: candidate, addedKm: afterKm - beforeKm, addedMinutes: candidate.metrics.durationMinutes - route.metrics.durationMinutes, stopOffsetM: Math.round(projectOnRoute(segment, poi.coordinate).offsetM) }
}
