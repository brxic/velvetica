import { z } from 'zod'

export const accountPreferencesSchema = z.object({
  profile: z.enum(['road', 'gravel', 'touring', 'city']).default('road'),
  distanceKm: z.number().int().min(5).max(250).default(60),
  speedKmh: z.number().min(5).max(50).default(22),
  surface: z.enum(['mostly-paved', 'balanced', 'unpaved-friendly']).default('balanced'),
  climbing: z.enum(['avoid', 'balanced', 'challenge']).default('balanced'),
  safety: z.enum(['quiet', 'balanced', 'direct']).default('quiet'),
})

export type AccountPreferences = z.infer<typeof accountPreferencesSchema>
export const defaultAccountPreferences = accountPreferencesSchema.parse({})

export class RouteConflictError extends Error {
  constructor() { super('VERSION_CONFLICT') }
}
