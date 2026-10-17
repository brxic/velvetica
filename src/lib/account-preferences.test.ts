import { describe, expect, it } from 'vitest'
import { accountPreferencesSchema, defaultAccountPreferences } from './account-preferences'

describe('account planning defaults', () => {
  it('rejects implausible speeds, distances and unsupported profiles', () => {
    for (const value of [{ speedKmh: 0 }, { distanceKm: 999 }, { profile: 'mtb' }, { surface: 'unknown' }]) expect(accountPreferencesSchema.safeParse(value).success).toBe(false)
    expect(defaultAccountPreferences).toMatchObject({ profile: 'road', speedKmh: 22, distanceKm: 60 })
  })
})
