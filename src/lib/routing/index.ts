import type { PlanningRequest } from '@/lib/domain'
import { planPreviewRoute } from '@/lib/preview-router'
import type { RoutingProvider } from './provider'
import { ValhallaProvider } from './valhalla'
import { FossgisBikeProvider } from './fossgis'

const previewProvider: RoutingProvider = { id: 'preview', async plan(request) { return planPreviewRoute(request) } }

export function getRoutingProvider(): RoutingProvider {
  if (process.env.ROUTING_PROVIDER === 'valhalla' && process.env.VALHALLA_URL) return new ValhallaProvider(process.env.VALHALLA_URL)
  if (process.env.ROUTING_PROVIDER === 'fossgis') return new FossgisBikeProvider(process.env.FOSSGIS_URL)
  return previewProvider
}

export async function planRoute(request: PlanningRequest) {
  const provider = getRoutingProvider()
  try { return await provider.plan(request) }
  catch (error) {
    if (provider.id === 'preview' || process.env.ROUTING_FALLBACK !== 'preview') throw error
    const fallback = planPreviewRoute(request)
    return { ...fallback, warnings: [request.locale === 'de' ? 'Der Routingdienst ist nicht erreichbar. Angezeigt wird eine Testvorschau, die sich nicht zum Nachfahren eignet.' : 'The routing service is unavailable. This is a test preview, not a route to ride.'] }
  }
}
