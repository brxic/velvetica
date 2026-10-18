import { routeOwner, withAnonymousOwner } from '@/lib/anonymous-owner'

export const runtime = 'nodejs'

/** Identity only: recovery must still work when the route database is down. */
export async function GET(request: Request) {
  try {
    const owner = await routeOwner(request)
    // Do not interpret an unverifiable account session as a guest workspace.
    const hasCredentials = request.headers.has('authorization') || /(?:^|;\s*)sb-[^=]+-auth-token/.test(request.headers.get('cookie') ?? '')
    if (hasCredentials && !owner.userId) return Response.json({ code: 'IDENTITY_UNVERIFIED' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    return withAnonymousOwner(Response.json({ storageScope: owner.storageScope, authenticated: Boolean(owner.userId) }), owner.ownerKey, owner.setCookie, owner.secure)
  } catch {
    return Response.json({ code: 'IDENTITY_UNVERIFIED' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
