import { z } from 'zod'

const coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
const waypoint = z.object({ id: z.string().min(1).max(100), coordinate, label: z.string().max(200), kind: z.enum(['start', 'end', 'via', 'shaping', 'generated']) })

export const homePointSchema = z.object({
  label: z.string().trim().min(1).max(200),
  coordinate,
})

export const plannedRouteSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(80), description: z.string().max(300).optional(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime().optional(), profile: z.enum(['road', 'gravel', 'touring', 'city']), mode: z.enum(['round-trip', 'one-way']),
  geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(coordinate).min(2).max(20_000) }),
  waypoints: z.array(waypoint).max(100),
  metrics: z.object({ distanceKm: z.number().min(0).max(10_000), durationMinutes: z.number().int().min(0).max(100_000), elevationGainM: z.number().min(0).max(100_000), elevationLossM: z.number().min(0).max(100_000), asphaltPercent: z.number().min(0).max(100), cyclewayPercent: z.number().min(0).max(100), confidence: z.enum(['preview', 'verified']), elevationProfile: z.array(z.number().min(-1_000).max(10_000)).max(5_000) }),
  warnings: z.array(z.string().max(500)).max(50),
  provenance: z.object({ routingEngine: z.string().max(100), primaryDataSource: z.string().max(200), graphVersion: z.string().max(100), dataUpdatedAt: z.string().datetime(), analyzedAt: z.string().datetime(), regionId: z.string().max(30), confidence: z.enum(['low', 'medium', 'high']) }),
  favorite: z.boolean().optional(), serverVersion: z.number().int().positive().optional(),
})
