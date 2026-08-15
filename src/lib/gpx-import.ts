import type { BikeProfile, Coordinate, Locale, PlannedRoute, RouteMode, Waypoint } from './domain'
import { distanceKm } from './routing/round-trip-quality'

export const MAX_GPX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_GPX_POINTS = 20_000
const MAX_GPX_SEGMENTS = 50

export class GpxImportError extends Error {
  constructor(public readonly code: 'unsafe-xml' | 'invalid-xml' | 'too-many-points' | 'too-many-segments' | 'not-enough-points') {
    super(code)
    this.name = 'GpxImportError'
  }
}

type RawPoint = { coordinate: Coordinate; elevation?: number }

function elements(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name))
}

function pointFromElement(element: Element): RawPoint | null {
  const latitude = Number(element.getAttribute('lat'))
  const longitude = Number(element.getAttribute('lon'))
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  const elevationText = elements(element, 'ele')[0]?.textContent
  const elevation = elevationText == null ? undefined : Number(elevationText)
  return { coordinate: [longitude, latitude], elevation: Number.isFinite(elevation) ? elevation : undefined }
}

function fillElevations(points: RawPoint[]) {
  const known = points.flatMap((point, index) => point.elevation === undefined ? [] : [{ index, value: point.elevation }])
  if (!known.length) return []
  return points.map((point, index) => {
    if (point.elevation !== undefined) return point.elevation
    const before = known.findLast((sample) => sample.index < index)
    const after = known.find((sample) => sample.index > index)
    if (!before) return after!.value
    if (!after) return before.value
    const ratio = (index - before.index) / (after.index - before.index)
    return before.value + (after.value - before.value) * ratio
  })
}

function elevationTotals(profile: number[]) {
  let gain = 0; let loss = 0
  for (let index = 1; index < profile.length; index++) {
    const delta = profile[index] - profile[index - 1]
    if (Math.abs(delta) > 80) continue
    if (delta > 0) gain += delta
    else loss -= delta
  }
  return { gain: Math.round(gain), loss: Math.round(loss) }
}

function baseName(fileName: string) {
  return fileName.replace(/\.gpx$/i, '').trim() || 'GPX route'
}

function speedFor(profile: BikeProfile) {
  return ({ road: 24, gravel: 18, touring: 19, city: 16 })[profile]
}

export function parseGpx(text: string, fileName: string, locale: Locale, profile: BikeProfile): PlannedRoute {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text)) throw new GpxImportError('unsafe-xml')
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (elements(document, 'parsererror').length || document.documentElement.localName.toLowerCase() !== 'gpx') throw new GpxImportError('invalid-xml')

  const trackSegments = elements(document, 'trkseg')
  if (trackSegments.length > MAX_GPX_SEGMENTS) throw new GpxImportError('too-many-segments')
  const segmentElements = trackSegments.length ? trackSegments.map((segment) => elements(segment, 'trkpt')) : [elements(document, 'rtept')]
  const rawElements = segmentElements.flat()
  if (rawElements.length > MAX_GPX_POINTS) throw new GpxImportError('too-many-points')
  const points = rawElements.map(pointFromElement).filter((point): point is RawPoint => point !== null)
  if (points.length < 2) throw new GpxImportError('not-enough-points')

  const coordinates = points.map((point) => point.coordinate)
  const totalDistance = coordinates.slice(1).reduce((sum, coordinate, index) => sum + distanceKm(coordinates[index], coordinate), 0)
  const isClosed = distanceKm(coordinates[0], coordinates.at(-1)!) <= .15
  const mode: RouteMode = isClosed ? 'round-trip' : 'one-way'
  const elevationProfile = fillElevations(points)
  const elevations = elevationTotals(elevationProfile)
  const invalidCount = rawElements.length - points.length
  const missingElevationCount = points.filter((point) => point.elevation === undefined).length
  const de = locale === 'de'
  const warnings = [
    de ? 'Untergrund und Radweganteil wurden beim GPX-Import nicht analysiert.' : 'Surface and cycleway share were not analysed during GPX import.',
    ...(trackSegments.length > 1 ? [de ? `Die Datei enthält ${trackSegments.length} Track-Segmente; mögliche Lücken bleiben erhalten.` : `The file contains ${trackSegments.length} track segments; possible gaps are preserved.`] : []),
    ...(invalidCount ? [de ? `${invalidCount} ungültige Punkte wurden übersprungen.` : `${invalidCount} invalid points were skipped.`] : []),
    ...(missingElevationCount === points.length ? [de ? 'Die Datei enthält keine Höhendaten.' : 'The file contains no elevation data.'] : missingElevationCount ? [de ? `${missingElevationCount} fehlende Höhenwerte wurden nur für das Profil interpoliert.` : `${missingElevationCount} missing elevation values were interpolated for the profile only.`] : []),
  ]
  const now = new Date().toISOString()
  const metadata = elements(document, 'metadata')[0]
  const metadataName = metadata ? elements(metadata, 'name')[0]?.textContent?.trim() : undefined
  const routeContainer = elements(document, trackSegments.length ? 'trk' : 'rte')[0]
  const containedName = routeContainer ? elements(routeContainer, 'name')[0]?.textContent?.trim() : undefined
  const routeName = metadataName || containedName || baseName(fileName)
  const waypoints: Waypoint[] = [
    { id: crypto.randomUUID(), coordinate: coordinates[0], label: de ? 'Start' : 'Start', kind: 'start' },
    ...(!isClosed ? [{ id: crypto.randomUUID(), coordinate: coordinates.at(-1)!, label: de ? 'Ziel' : 'Destination', kind: 'end' as const }] : []),
  ]

  return {
    id: crypto.randomUUID(), name: routeName, description: de ? `Originalimport aus ${fileName}` : `Original import from ${fileName}`,
    createdAt: now, updatedAt: now, profile, mode, geometry: { type: 'LineString', coordinates }, waypoints,
    metrics: { distanceKm: Math.round(totalDistance * 10) / 10, durationMinutes: Math.max(1, Math.round(totalDistance / speedFor(profile) * 60)), elevationGainM: elevations.gain, elevationLossM: elevations.loss, asphaltPercent: 0, cyclewayPercent: 0, confidence: 'preview', elevationProfile },
    warnings,
    provenance: { routingEngine: 'GPX Import', primaryDataSource: fileName, graphVersion: 'original', dataUpdatedAt: now, analyzedAt: now, regionId: 'import', confidence: 'low' },
  }
}
