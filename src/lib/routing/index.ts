import type { PlanningRequest } from '@/lib/domain'
import { planPreviewRoute } from '@/lib/preview-router'
import type { RoutingProvider } from './provider'
import { ValhallaProvider } from './valhalla'
import { FossgisBikeProvider } from './fossgis'
import { RoutingError, routingErrorCode } from './errors'
import { plannedRouteSchema } from '../route-schema'

const previewProvider: RoutingProvider = { id: 'preview', async plan(request) { return planPreviewRoute(request) } }

export function getRoutingProvider(): RoutingProvider {
  if (process.env.ROUTING_PROVIDER === 'valhalla' && process.env.VALHALLA_URL) return new ValhallaProvider(process.env.VALHALLA_URL)
  if (process.env.ROUTING_PROVIDER === 'fossgis') return new FossgisBikeProvider(process.env.FOSSGIS_URL)
  if (process.env.ROUTING_PROVIDER && process.env.ROUTING_PROVIDER !== 'preview') throw new RoutingError('ROUTER_CONFIG')
  return previewProvider
}

export async function planRoute(request: PlanningRequest, signal?: AbortSignal) {
  const provider = getRoutingProvider()
  const budget = AbortSignal.any([AbortSignal.timeout(50_000), ...(signal ? [signal] : [])])
  try {
    const result = plannedRouteSchema.safeParse(await provider.plan(request, budget))
    if (!result.success) {
      console.warn('[routing] invalid provider result', { fields: result.error.issues.map((issue) => issue.path.join('.')) })
      throw new RoutingError('ROUTE_QUALITY_FAILED')
    }
    return result.data
  }
  catch (error) {
    // A quality rejection is not a service outage and must never become a fake route.
    if (provider.id === 'preview' || process.env.NODE_ENV === 'production' || process.env.ROUTING_FALLBACK !== 'preview' || !['ROUTER_TIMEOUT', 'ROUTER_UNAVAILABLE'].includes(routingErrorCode(error))) throw error
    const fallback = planPreviewRoute(request)
    return { ...fallback, warnings: [request.locale === 'de' ? 'Der Routingdienst ist nicht erreichbar. Angezeigt wird eine Testvorschau, die sich nicht zum Nachfahren eignet.' : 'The routing service is unavailable. This is a test preview, not a route to ride.'] }
  }
}
