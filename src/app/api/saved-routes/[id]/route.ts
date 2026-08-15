import { anonymousOwner, withAnonymousOwner } from '@/lib/anonymous-owner'
import { plannedRouteSchema } from '@/lib/route-schema'
import { deleteSavedRoute, persistenceEnabled, saveSavedRoute } from '@/lib/saved-route-store'

export const runtime = 'nodejs'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!persistenceEnabled()) return Response.json({ code: 'PERSISTENCE_DISABLED' }, { status: 503 })
  const { id } = await params; const parsed = plannedRouteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || parsed.data.id !== id) return Response.json({ code: 'INVALID_ROUTE' }, { status: 400 })
  const owner = anonymousOwner(request)
  try { return withAnonymousOwner(Response.json({ route: await saveSavedRoute(owner.ownerKey, parsed.data) }), owner.ownerKey, owner.setCookie, owner.secure) }
  catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!persistenceEnabled()) return Response.json({ code: 'PERSISTENCE_DISABLED' }, { status: 503 })
  const { id } = await params; const owner = anonymousOwner(request)
  try {
    const deleted = await deleteSavedRoute(owner.ownerKey, id)
    return withAnonymousOwner(deleted ? new Response(null, { status: 204 }) : Response.json({ code: 'NOT_FOUND' }, { status: 404 }), owner.ownerKey, owner.setCookie, owner.secure)
  } catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}
