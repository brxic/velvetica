import { createRequestSupabase, requestBearerToken } from '@/lib/supabase/server'
import { exportAccount, deleteAccount } from '@/lib/saved-route-store'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = createRequestSupabase(request)
  const user = supabase && await supabase.auth.getUser(requestBearerToken(request))
  if (!user || user.error || !user.data.user) return Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
  try {
    return Response.json({ account: { email: user.data.user.email, createdAt: user.data.user.created_at }, ...await exportAccount(user.data.user.id) }, {
      headers: { 'Cache-Control': 'private, no-store', 'Content-Disposition': 'attachment; filename="velvetia-account.json"' },
    })
  } catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}

export async function DELETE(request: Request) {
  const supabase = createRequestSupabase(request)
  const user = supabase && await supabase.auth.getUser(requestBearerToken(request))
  if (!supabase || !user || user.error || !user.data.user?.email) return Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (body?.confirmation !== 'DELETE' || typeof body?.password !== 'string' || body.password.length > 1024) return Response.json({ code: 'CONFIRMATION_REQUIRED' }, { status: 400 })
  const verified = await supabase.auth.signInWithPassword({ email: user.data.user.email, password: body.password })
  if (verified.error || verified.data.user?.id !== user.data.user.id) return Response.json({ code: 'PASSWORD_INCORRECT' }, { status: 403 })
  try { await deleteAccount(user.data.user.id); return new Response(null, { status: 204 }) }
  catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}
