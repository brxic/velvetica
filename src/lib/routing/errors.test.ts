import { afterEach, describe, expect, it, vi } from 'vitest'
import { RoutingError, routingErrorCode, routingErrorMessage } from './errors'
import { routerResponse } from './transport'
import { getRoutingProvider, planRoute } from './index'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('routing failures and configuration', () => {
  it('distinguishes timeout, disconnected network and implausible output', () => {
    expect(routingErrorCode(new DOMException('timeout', 'TimeoutError'))).toBe('ROUTER_TIMEOUT')
    expect(routingErrorCode(new TypeError('fetch failed'))).toBe('ROUTER_UNAVAILABLE')
    expect(routingErrorCode(new Error('ROUTE_GEOMETRY_DISCONTINUITY'))).toBe('ROUTE_QUALITY_FAILED')
    expect(routingErrorMessage('unexpected private upstream message', 'de')).not.toContain('private')
  })
  it('uses upstream structured error codes rather than arbitrary messages', async () => {
    await expect(routerResponse(Response.json({ error_code: 171 }, { status: 400 }), 'valhalla')).rejects.toMatchObject({ code: 'NO_ROUTE' })
    await expect(routerResponse(Response.json({ code: 'NoRoute' }, { status: 400 }), 'fossgis')).rejects.toMatchObject({ code: 'NO_ROUTE' })
    await expect(routerResponse(new Response('bad gateway', { status: 504 }), 'valhalla')).rejects.toMatchObject({ code: 'ROUTER_TIMEOUT' })
  })
  it('does not silently use a preview for a broken real-router configuration', () => {
    vi.stubEnv('ROUTING_PROVIDER', 'valhalla'); vi.stubEnv('VALHALLA_URL', '')
    expect(() => getRoutingProvider()).toThrow('ROUTER_CONFIG')
  })
  it('never falls back to simulated output in production', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('ROUTING_PROVIDER', 'fossgis'); vi.stubEnv('ROUTING_FALLBACK', 'preview')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(planRoute({ locale: 'de', mode: 'one-way', profile: 'road', targetDistanceKm: 5, waypoints: [{ id: 'start', kind: 'start', label: 'Start', coordinate: [7.44, 46.95] }, { id: 'end', kind: 'end', label: 'End', coordinate: [7.46, 46.95] }], preferences: { surface: 'balanced', climbing: 'balanced', safety: 'quiet' } })).rejects.toThrow('offline')
  })
  it('preserves a typed quality rejection', () => { expect(routingErrorCode(new RoutingError('ROUTE_QUALITY_FAILED'))).toBe('ROUTE_QUALITY_FAILED') })
})
