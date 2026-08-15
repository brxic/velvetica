import type { BikeProfile, Locale, RouteMode, Waypoint } from './domain'

const profileNames: Record<Locale, Record<BikeProfile, string>> = {
  de: { road: 'Rennrad', gravel: 'Gravel', touring: 'Touring', city: 'City' },
  en: { road: 'Road', gravel: 'Gravel', touring: 'Touring', city: 'City' },
}

export function createRouteName(locale: Locale, profile: BikeProfile, mode: RouteMode, waypoints: Waypoint[]) {
  const startLabel = waypoints.find((point) => point.kind === 'start')?.label.split(',')[0].trim()
  const place = startLabel && !/^start$/i.test(startLabel) ? startLabel.slice(0, 35) : 'Velvetia'
  const suffix = mode === 'round-trip'
    ? locale === 'de' ? `${profileNames.de[profile]}-Runde` : `${profileNames.en[profile]} loop`
    : locale === 'de' ? `${profileNames.de[profile]}-Route` : `${profileNames.en[profile]} route`
  return `${place} ${suffix}`
}
