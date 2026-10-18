import type { Locale } from '../domain'

export type RoutingErrorCode = 'INVALID_REQUEST' | 'POINT_OFF_NETWORK' | 'NO_ROUTE' | 'ROUTE_QUALITY_FAILED' | 'ROUTER_TIMEOUT' | 'ROUTER_UNAVAILABLE' | 'ROUTER_CONFIG' | 'ROUTE_FAILED'

export class RoutingError extends Error {
  constructor(readonly code: RoutingErrorCode) { super(code); this.name = 'RoutingError' }
}

export function routingErrorCode(error: unknown): RoutingErrorCode {
  if (error instanceof RoutingError) return error.code
  if (error instanceof Error || (typeof DOMException !== 'undefined' && error instanceof DOMException)) {
    if (error.name === 'TimeoutError') return 'ROUTER_TIMEOUT'
    if (error.message === 'ROUTE_ENDPOINT_MISMATCH') return 'POINT_OFF_NETWORK'
    if (/^ROUTE_(QUALITY_FAILED|INVALID_GEOMETRY|GEOMETRY_DISCONTINUITY)$/.test(error.message)) return 'ROUTE_QUALITY_FAILED'
    if (error.message === 'VALHALLA_EMPTY_ROUTE' || error.message === 'FOSSGIS_EMPTY_ROUTE') return 'NO_ROUTE'
    if (/^(VALHALLA|FOSSGIS)_HTTP_/.test(error.message) || error instanceof TypeError) return 'ROUTER_UNAVAILABLE'
  }
  return 'ROUTE_FAILED'
}

export function routingErrorStatus(code: RoutingErrorCode) {
  if (code === 'INVALID_REQUEST') return 400
  if (code === 'ROUTER_TIMEOUT') return 504
  if (code === 'ROUTER_UNAVAILABLE' || code === 'ROUTER_CONFIG') return 503
  return 422
}

const messages: Record<RoutingErrorCode, [string, string]> = {
  INVALID_REQUEST: ['Prüfe Start, Ziel und Zwischenpunkte. Für eine Route sind höchstens 20 Punkte möglich.', 'Check the start, destination and waypoints. A route supports up to 20 points.'],
  POINT_OFF_NETWORK: ['Ein Punkt liegt zu weit vom berechneten Wegenetz entfernt. Versetze Start oder Ziel auf einen erreichbaren Weg.', 'A point is too far from the calculated road network. Move the start or destination onto an accessible road or path.'],
  NO_ROUTE: ['Zwischen diesen Punkten wurde keine Fahrradverbindung gefunden. Versetze die Punkte auf erreichbare Wege.', 'No bicycle connection was found between these points. Move the points onto accessible roads or paths.'],
  ROUTE_QUALITY_FAILED: ['Es wurde keine ausreichend plausible Route gefunden. Versetze die Punkte oder ändere bei einer Rundtour die Distanz.', 'No sufficiently plausible route was found. Move the points or change the distance for a round trip.'],
  ROUTER_TIMEOUT: ['Die Berechnung dauert zu lange. Versuche es erneut oder vereinfache die Route.', 'The calculation took too long. Try again or simplify the route.'],
  ROUTER_UNAVAILABLE: ['Der Routingdienst ist gerade nicht erreichbar. Versuche es später erneut.', 'The routing service is currently unavailable. Try again later.'],
  ROUTER_CONFIG: ['Der Routingdienst ist nicht korrekt eingerichtet. Eine neue Berechnung ist derzeit nicht möglich.', 'The routing service is not configured correctly. New routes cannot currently be calculated.'],
  ROUTE_FAILED: ['Die Route konnte nicht berechnet werden. Prüfe die Punkte und versuche es erneut.', 'The route could not be planned. Check the points and try again.'],
}

export function routingErrorMessage(code: unknown, locale: Locale) {
  const known = typeof code === 'string' && Object.hasOwn(messages, code) ? code as RoutingErrorCode : 'ROUTE_FAILED'
  return messages[known][locale === 'de' ? 0 : 1]
}
