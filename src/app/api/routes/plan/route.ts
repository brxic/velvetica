import { z } from 'zod'
import { planRoute } from '@/lib/routing'

const coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
const waypoint = z.object({ id: z.string(), coordinate, label: z.string(), kind: z.enum(['start', 'end', 'via']) })
const requestSchema = z.object({
  profile: z.enum(['road', 'gravel', 'touring', 'city']),
  mode: z.enum(['round-trip', 'one-way']),
  targetDistanceKm: z.number().min(2).max(500),
  waypoints: z.array(waypoint).min(1).max(20),
})

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ code: 'INVALID_REQUEST', issues: parsed.error.issues }, { status: 400 })
  try { return Response.json(await planRoute(parsed.data), { status: 201 }) }
  catch { return Response.json({ code: 'ROUTE_FAILED' }, { status: 422 }) }
}
