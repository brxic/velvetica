import type { PlannedRoute } from './domain'

export type RouteSyncState = 'local' | 'syncing' | 'synced' | 'conflict' | 'error'

export function routeSignature(route: PlannedRoute) {
  return JSON.stringify({ name: route.name.trim(), description: route.description ?? '', profile: route.profile, mode: route.mode, geometry: route.geometry, waypoints: route.waypoints.filter((point) => point.kind !== 'generated'), metrics: route.metrics })
}

/** A late acknowledgement must never reopen a discarded route or replace newer edits. */
export function acknowledgeSavedDraft(current: PlannedRoute | null, submitted: PlannedRoute, acknowledged: PlannedRoute) {
  if (!current || current.id !== submitted.id) return current
  return routeSignature(current) === routeSignature(submitted) ? acknowledged : { ...current, serverVersion: acknowledged.serverVersion }
}
