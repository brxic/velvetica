import { describe, expect, it } from 'vitest'
import { homePointSchema, plannedRouteSchema } from './route-schema'

describe('saved route validation', () => {
  it('rejects malformed identifiers and out-of-range geometry', () => {
    const parsed = plannedRouteSchema.safeParse({ id: 'not-an-id', name: 'Bad route', geometry: { type: 'LineString', coordinates: [[999, 999], [7, 46]] } })
    expect(parsed.success).toBe(false)
  })

  it('accepts a named home point and rejects invalid coordinates', () => {
    expect(homePointSchema.safeParse({ label: 'Zuhause', coordinate: [7.5886, 47.5596] }).success).toBe(true)
    expect(homePointSchema.safeParse({ label: '', coordinate: [7.5886, 47.5596] }).success).toBe(false)
    expect(homePointSchema.safeParse({ label: 'Zuhause', coordinate: [181, 47.5596] }).success).toBe(false)
  })
})
