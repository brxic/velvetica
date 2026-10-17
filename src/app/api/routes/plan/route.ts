import { z } from 'zod'
import { planRoute } from '@/lib/routing'

export const runtime = 'nodejs'
export const maxDuration = 60

const coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
const waypoint = z.object({ id: z.string().min(1).max(100), coordinate, label: z.string().max(200), kind: z.enum(['start', 'end', 'via', 'shaping', 'generated']) })
const requestSchema = z.object({
  locale: z.enum(['de', 'en']),
  profile: z.enum(['road', 'gravel', 'touring', 'city']),
  mode: z.enum(['round-trip', 'one-way']),
  targetDistanceKm: z.number().min(2).max(500),
  waypoints: z.array(waypoint).min(1).max(20),
  preferences: z.object({
    surface: z.enum(['mostly-paved', 'balanced', 'unpaved-friendly']),
    climbing: z.enum(['avoid', 'balanced', 'challenge']),
    safety: z.enum(['quiet', 'balanced', 'direct']),
  }),
}).refine((request) => request.waypoints.some((point) => point.kind === 'start') && (request.mode === 'round-trip' || request.waypoints.some((point) => point.kind === 'end')), { message: 'Start and destination are required' })

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ code: 'INVALID_REQUEST', issues: parsed.error.issues }, { status: 400 })
  try { return Response.json(await planRoute(parsed.data), { status: 201 }) }
  catch { return Response.json({ code: 'ROUTE_FAILED' }, { status: 422 }) }
}
