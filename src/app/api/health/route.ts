import { getHealthChecks, summarizeHealth } from '@/lib/health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = await getHealthChecks()
  const status = summarizeHealth(checks)

  return Response.json(
    { status, service: 'velvetia-web', timestamp: new Date().toISOString(), checks },
    {
      status: status === 'healthy' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
