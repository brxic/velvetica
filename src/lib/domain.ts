export type Locale = 'de' | 'en'
export type BikeProfile = 'road' | 'gravel' | 'touring' | 'city'
export type RouteMode = 'round-trip' | 'one-way'

export type Coordinate = [longitude: number, latitude: number]

export type Waypoint = {
  id: string
  coordinate: Coordinate
  label: string
  kind: 'start' | 'end' | 'via'
}

export type RouteMetrics = {
  distanceKm: number
  durationMinutes: number
  elevationGainM: number
  elevationLossM: number
  asphaltPercent: number
  cyclewayPercent: number
  confidence: 'preview' | 'verified'
  elevationProfile: number[]
}

export type RoutePreferences = {
  surface: 'mostly-paved' | 'balanced' | 'unpaved-friendly'
  climbing: 'avoid' | 'balanced' | 'challenge'
  safety: 'quiet' | 'balanced' | 'direct'
}

export type RouteProvenance = {
  routingEngine: string
  primaryDataSource: string
  graphVersion: string
  dataUpdatedAt: string
  analyzedAt: string
  regionId: string
  confidence: 'low' | 'medium' | 'high'
}

export type PlannedRoute = {
  id: string
  name: string
  createdAt: string
  profile: BikeProfile
  mode: RouteMode
  geometry: GeoJSON.LineString
  waypoints: Waypoint[]
  metrics: RouteMetrics
  warnings: string[]
  provenance: RouteProvenance
  favorite?: boolean
}

export type PlanningRequest = {
  profile: BikeProfile
  mode: RouteMode
  targetDistanceKm: number
  waypoints: Waypoint[]
  preferences: RoutePreferences
}

export const SWITZERLAND = {
  id: 'ch',
  name: 'Schweiz',
  center: [8.2275, 46.8182] as Coordinate,
  bounds: [5.8, 45.7, 10.7, 47.9] as [number, number, number, number],
  defaultZoom: 7,
  timezone: 'Europe/Zurich',
  projection: 'EPSG:2056',
  mapStyle: 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json',
  attribution: '© Data: swisstopo · © OpenStreetMap contributors',
} as const
