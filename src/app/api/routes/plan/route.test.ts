import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { RoutingError } from '@/lib/routing/errors'
const { planRoute } = vi.hoisted(() => ({ planRoute: vi.fn() }))
vi.mock('@/lib/routing', () => ({ planRoute }))
const start = { id: 'start', kind: 'start', coordinate: [7.44, 46.95], label: 'Start' }
const end = { id: 'end', kind: 'end', coordinate: [7.46, 46.95], label: 'End' }
const payload = { locale: 'de', profile: 'road', mode: 'one-way', targetDistanceKm: 60, waypoints: [end, start], preferences: { surface: 'balanced', climbing: 'avoid', safety: 'quiet' } }
const request = (value: unknown) => new Request('http://localhost/api/routes/plan', { method: 'POST', body: JSON.stringify(value) })
afterEach(() => { vi.clearAllMocks() })

describe('routing error contract', () => {
  it.each([['POINT_OFF_NETWORK', 422], ['NO_ROUTE', 422], ['ROUTE_QUALITY_FAILED', 422], ['ROUTER_TIMEOUT', 504], ['ROUTER_UNAVAILABLE', 503], ['ROUTER_CONFIG', 503]] as const)('returns a safe %s error', async (code, status) => {
    planRoute.mockRejectedValueOnce(new RoutingError(code))
    const response = await POST(request(payload))
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ code })
  })
  it('validates duplicate points and orders endpoints before invoking a router', async () => {
    expect((await POST(request({ ...payload, waypoints: [start, start, end] }))).status).toBe(400)
    expect(planRoute).not.toHaveBeenCalled()
    planRoute.mockResolvedValueOnce({ id: 'contract-result' })
    const response = await POST(request(payload))
    expect(response.status).toBe(201)
    expect(planRoute.mock.calls[0][0].waypoints).toEqual([start, end])
  })
  it('does not leak unexpected upstream messages', async () => {
    planRoute.mockRejectedValueOnce(new Error('https://secret:password@router.internal'))
    expect(await (await POST(request(payload))).json()).toEqual({ code: 'ROUTE_FAILED' })
  })
})
