import type { PlannedRoute } from '../src/lib/domain'

export const rideTestRoute: PlannedRoute = {
  id: 'f8d703ee-b3ca-4314-aaff-3f84872111f2', name: 'Bern Testfahrt', createdAt: '2026-10-18T12:00:00Z', profile: 'road', mode: 'one-way',
  geometry: { type: 'LineString', coordinates: [[7.44, 46.95], [7.45, 46.95], [7.46, 46.95]] }, waypoints: [],
  metrics: { distanceKm: 1.5, durationMinutes: 6, elevationGainM: 40, elevationLossM: 20, asphaltPercent: 0, cyclewayPercent: 0, confidence: 'verified', elevationProfile: [500, 540, 520], elevationAnalyzed: true }, warnings: [],
  provenance: { routingEngine: 'Valhalla test', primaryDataSource: 'test', graphVersion: 'test', dataUpdatedAt: '2026-10-18T12:00:00Z', analyzedAt: '2026-10-18T12:00:00Z', regionId: 'ch', confidence: 'medium' },
}
