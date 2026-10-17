import { authenticatedUserId } from '@/lib/supabase/server'
import { accountPreferencesSchema } from '@/lib/account-preferences'
import { getAccountPreferences, saveAccountPreferences } from '@/lib/saved-route-store'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const userId = await authenticatedUserId(request)
  if (!userId) return Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
  try { return Response.json({ preferences: await getAccountPreferences(userId) }, { headers: { 'Cache-Control': 'private, no-store' } }) }
  catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}

export async function PUT(request: Request) {
  const userId = await authenticatedUserId(request)
  if (!userId) return Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 })
  const parsed = accountPreferencesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ code: 'INVALID_PREFERENCES' }, { status: 400 })
  try { return Response.json({ preferences: await saveAccountPreferences(userId, parsed.data) }) }
  catch { return Response.json({ code: 'PERSISTENCE_FAILED' }, { status: 503 }) }
}
