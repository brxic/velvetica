import { describe, expect, it } from 'vitest'

import { summarizeHealth, type HealthChecks } from './health'

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
})
