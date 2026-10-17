import { authenticatedUserId } from '@/lib/supabase/server'
import { createRouteShare, revokeRouteShare } from '@/lib/saved-route-store'
import { z } from 'zod'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Context) {
  const userId = await authenticatedUserId(request)
  if (!userId) return Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return Response.json({ code: 'INVALID_ID' }, { status: 400 })
  try {
    const token = await createRouteShare(userId, id)
    return token ? Response.json({ path: `/share/${token}` }, { headers: { 'Cache-Control': 'private, no-store' } }) : Response.json({ code: 'NOT_FOUND' }, { status: 404 })
  } catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}

export async function DELETE(request: Request, { params }: Context) {
  const userId = await authenticatedUserId(request)
  if (!userId) return Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return Response.json({ code: 'INVALID_ID' }, { status: 400 })
  try { await revokeRouteShare(userId, id); return new Response(null, { status: 204 }) }
  catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}
