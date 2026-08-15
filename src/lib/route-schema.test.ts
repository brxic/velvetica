import { describe, expect, it } from 'vitest'
import { plannedRouteSchema } from './route-schema'

describe('saved route validation', () => {
  it('rejects malformed identifiers and out-of-range geometry', () => {
    const parsed = plannedRouteSchema.safeParse({ id: 'not-an-id', name: 'Bad route', geometry: { type: 'LineString', coordinates: [[999, 999], [7, 46]] } })
    expect(parsed.success).toBe(false)
  })
})
