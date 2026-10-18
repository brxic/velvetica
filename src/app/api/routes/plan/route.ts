import { z } from 'zod'
import { planRoute } from '@/lib/routing'
import { routingErrorCode, routingErrorStatus } from '@/lib/routing/errors'

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
}).refine((request) => request.waypoints.filter((point) => point.kind === 'start').length === 1 && (request.mode === 'round-trip' ? !request.waypoints.some((point) => point.kind === 'end') : request.waypoints.filter((point) => point.kind === 'end').length === 1) && new Set(request.waypoints.map((point) => point.id)).size === request.waypoints.length, { message: 'One start, a destination for one-way routes and unique waypoint IDs are required' })

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ code: 'INVALID_REQUEST', issues: parsed.error.issues }, { status: 400 })
  const input = parsed.data
  const waypoints = [...input.waypoints.filter((point) => point.kind === 'start'), ...input.waypoints.filter((point) => point.kind !== 'start' && point.kind !== 'end'), ...input.waypoints.filter((point) => point.kind === 'end')]
  try { return Response.json(await planRoute({ ...input, waypoints }, request.signal), { status: 201, headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) {
    const code = routingErrorCode(error)
    // No coordinates, route payloads, provider URLs or credentials in logs.
    const reason = error instanceof Error && /^ROUTE_[A-Z_]+$/.test(error.message) ? error.message : code
    console.warn('[routing] planning failed', { code, reason })
    return Response.json({ code }, { status: routingErrorStatus(code), headers: { 'Cache-Control': 'no-store' } })
  }
}
