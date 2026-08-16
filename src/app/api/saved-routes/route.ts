import { routeOwner, withAnonymousOwner } from '@/lib/anonymous-owner'
import { plannedRouteSchema } from '@/lib/route-schema'
import { listSavedRoutes, persistenceEnabled, saveSavedRoute } from '@/lib/saved-route-store'

export const runtime = 'nodejs'

function disabled() { return Response.json({ code: 'PERSISTENCE_DISABLED' }, { status: 503 }) }

export async function GET(request: Request) {
  if (!persistenceEnabled()) return disabled()
  const owner = await routeOwner(request)
  try { return withAnonymousOwner(Response.json({ routes: await listSavedRoutes(owner), storageScope: owner.storageScope, authenticated: Boolean(owner.userId) }), owner.ownerKey, owner.setCookie, owner.secure) }
  catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}

export async function POST(request: Request) {
  if (!persistenceEnabled()) return disabled()
  const parsed = plannedRouteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ code: 'INVALID_ROUTE', issues: parsed.error.issues }, { status: 400 })
  const owner = await routeOwner(request)
  try { return withAnonymousOwner(Response.json({ route: await saveSavedRoute(owner, parsed.data) }, { status: 201 }), owner.ownerKey, owner.setCookie, owner.secure) }
  catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}
