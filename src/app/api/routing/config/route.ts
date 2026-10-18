import { getRoutingProvider } from '@/lib/routing'

export const dynamic = 'force-dynamic'

export function GET() {
  try {
    const provider = getRoutingProvider().id
    return Response.json({ provider, profileRouting: provider === 'valhalla', preview: provider === 'preview' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ provider: 'unavailable', profileRouting: false, preview: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
