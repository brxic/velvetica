import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkRouting, summarizeHealth, type HealthChecks } from './health'
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const healthyChecks: HealthChecks = {
  routing: { status: 'up', latencyMs: 12 },
  database: { status: 'up', latencyMs: 4 },
  cache: { status: 'up', latencyMs: 2 },
}

describe('summarizeHealth', () => {
  it('reports healthy when every configured dependency is available', () => {
    expect(summarizeHealth(healthyChecks)).toBe('healthy')
  })

  it('accepts intentionally disabled optional dependencies', () => {
    expect(summarizeHealth({ ...healthyChecks, routing: { status: 'disabled', latencyMs: 0 } })).toBe(
      'healthy',
    )
  })

  it('reports degraded when one dependency is unavailable', () => {
    expect(summarizeHealth({ ...healthyChecks, cache: { status: 'down', latencyMs: 2_500 } })).toBe(
      'degraded',
    )
  })
  it('does not report a configured but unreachable public router as up', async () => {
    vi.stubEnv('ROUTING_PROVIDER', 'fossgis')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect((await checkRouting()).status).toBe('down')
  })
})
