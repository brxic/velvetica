import type { Locale } from './domain'

export const messages = {
  de: {
    planner: 'Routenplaner', saved: 'Meine Routen', guide: 'So funktioniert’s',
    start: 'Start', destination: 'Ziel', roundTrip: 'Rundtour', oneWay: 'One-Way',
    bike: 'Fahrradtyp', distance: 'Distanz', calculate: 'Route planen',
    planning: 'Route wird geplant …', noStart: 'Wähle zuerst einen Startpunkt.',
    mapHint: 'Klicke auf die Karte, um den Startpunkt zu setzen.', routeReady: 'Deine Route ist bereit.',
    save: 'Route speichern', export: 'GPX exportieren', clear: 'Neu planen',
    road: 'Rennrad', gravel: 'Gravel', touring: 'Freizeit & Touring', city: 'Alltag & City',
    distanceLabel: 'Distanz', time: 'Fahrzeit', elevation: 'Höhenmeter', surface: 'Asphalt',
    preview: 'Lokale Vorschau', previewInfo: 'Der Preview-Router zeigt den Bedienablauf. Für straßengenaues Routing wird Valhalla angeschlossen.',
  },
  en: {
    planner: 'Route planner', saved: 'My routes', guide: 'How it works',
    start: 'Start', destination: 'Destination', roundTrip: 'Round trip', oneWay: 'One-way',
    bike: 'Bike type', distance: 'Distance', calculate: 'Plan route',
    planning: 'Planning route …', noStart: 'First choose a starting point.',
    mapHint: 'Click the map to choose your starting point.', routeReady: 'Your route is ready.',
    save: 'Save route', export: 'Export GPX', clear: 'Plan new route',
    road: 'Road', gravel: 'Gravel', touring: 'Leisure & touring', city: 'Commuting & city',
    distanceLabel: 'Distance', time: 'Ride time', elevation: 'Elevation', surface: 'Asphalt',
    preview: 'Local preview', previewInfo: 'The preview router demonstrates the workflow. Valhalla will provide road-accurate routing.',
  },
} as const satisfies Record<Locale, Record<string, string>>

export function t(locale: Locale) { return messages[locale] }
