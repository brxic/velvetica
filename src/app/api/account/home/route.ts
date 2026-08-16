import { routeOwner } from '@/lib/anonymous-owner'
import { homePointSchema } from '@/lib/route-schema'
import { getHomePoint, persistenceEnabled, saveHomePoint } from '@/lib/saved-route-store'

export const runtime = 'nodejs'

function unavailable() {
  return Response.json({ code: 'PERSISTENCE_DISABLED' }, { status: 503 })
}

function unauthorized() {
  return Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
}

export async function GET(request: Request) {
  if (!persistenceEnabled()) return unavailable()
  const owner = await routeOwner(request)
  if (!owner.userId) return unauthorized()
  try {
    return Response.json({ home: await getHomePoint(owner.userId), authenticated: true })
  } catch (error) {
    console.error('[account/home] read failed', { error: error instanceof Error ? error.message : String(error) })
    return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 })
  }
}

export async function PUT(request: Request) {
  if (!persistenceEnabled()) return unavailable()
  const owner = await routeOwner(request)
  if (!owner.userId) return unauthorized()
  const parsed = homePointSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ code: 'INVALID_HOME', issues: parsed.error.issues }, { status: 400 })
  try {
    return Response.json({ home: await saveHomePoint(owner.userId, parsed.data), authenticated: true })
  } catch (error) {
    console.error('[account/home] save failed', { error: error instanceof Error ? error.message : String(error) })
    return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 })
  }
}
