import { RoutingError } from './errors'

export function routingSignal(timeoutMs: number, signal?: AbortSignal) {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs)
}

export async function routerResponse(response: Response, provider: 'valhalla' | 'fossgis') {
  if (response.ok) return
  const body = await response.json().catch(() => null) as { error_code?: number; code?: string } | null
  if ((provider === 'valhalla' && [170, 171, 441, 442].includes(body?.error_code ?? -1)) || ['NoRoute', 'NoSegment'].includes(body?.code ?? '')) throw new RoutingError('NO_ROUTE')
  throw new RoutingError(response.status === 408 || response.status === 504 ? 'ROUTER_TIMEOUT' : 'ROUTER_UNAVAILABLE')
}
