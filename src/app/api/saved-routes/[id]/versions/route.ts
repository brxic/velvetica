import { anonymousOwner, withAnonymousOwner } from '@/lib/anonymous-owner'
import { listRouteVersions, persistenceEnabled } from '@/lib/saved-route-store'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!persistenceEnabled()) return Response.json({ code: 'PERSISTENCE_DISABLED' }, { status: 503 })
  const { id } = await params; const owner = anonymousOwner(request)
  try { return withAnonymousOwner(Response.json({ versions: await listRouteVersions(owner.ownerKey, id) }), owner.ownerKey, owner.setCookie, owner.secure) }
  catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}
