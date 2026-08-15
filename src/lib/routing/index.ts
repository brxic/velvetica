import type { PlanningRequest } from '@/lib/domain'
import { planPreviewRoute } from '@/lib/preview-router'
import type { RoutingProvider } from './provider'
import { ValhallaProvider } from './valhalla'

const previewProvider: RoutingProvider = { id: 'preview', async plan(request) { return planPreviewRoute(request) } }

export function getRoutingProvider(): RoutingProvider {
  if (process.env.ROUTING_PROVIDER === 'valhalla' && process.env.VALHALLA_URL) return new ValhallaProvider(process.env.VALHALLA_URL)
  return previewProvider
}

export async function planRoute(request: PlanningRequest) {
  const provider = getRoutingProvider()
  try { return await provider.plan(request) }
  catch (error) {
    if (provider.id === 'preview' || process.env.ROUTING_FALLBACK !== 'preview') throw error
    const fallback = planPreviewRoute(request)
    return { ...fallback, warnings: [request.locale === 'de' ? 'Routingdienst war nicht erreichbar; lokale Vorschau wird angezeigt.' : 'The routing service was unavailable; a local preview is shown.'] }
  }
}
