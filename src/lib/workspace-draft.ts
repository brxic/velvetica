import { z } from 'zod'
import { plannedRouteSchema } from './route-schema'
import type { PlannedRoute } from './domain'

const waypoint = z.object({ id: z.string().min(1).max(100), coordinate: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]), label: z.string().max(200), kind: z.enum(['start', 'end', 'via', 'shaping', 'generated']) })
export const workspaceSchema = z.object({
  mode: z.enum(['round-trip', 'one-way']), profile: z.enum(['road', 'gravel', 'touring', 'city']), distance: z.number().min(2).max(500),
  preferences: z.object({ surface: z.enum(['mostly-paved', 'balanced', 'unpaved-friendly']), climbing: z.enum(['avoid', 'balanced', 'challenge']), safety: z.enum(['quiet', 'balanced', 'direct']) }),
  route: plannedRouteSchema.extend({ name: z.string().max(80) }).nullable(),
  waypoints: z.array(waypoint).max(100),
})
export type WorkspaceDraft = Omit<z.infer<typeof workspaceSchema>, 'route'> & { route: PlannedRoute | null }
export type RecoveryDraft = { savedAt: number; workspace: WorkspaceDraft }
const envelope = z.object({ version: z.literal(1), savedAt: z.number().finite(), workspace: workspaceSchema })
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_DRAFT_CHARS = 4_000_000

export function workspaceDraftKey(scope: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(scope)) throw new Error('INVALID_WORKSPACE_SCOPE')
  return `velvetia.workspace.v1.${scope}`
}

export function parseWorkspaceDraft(raw: string | null, now = Date.now()): RecoveryDraft | null {
  if (!raw || raw.length > MAX_DRAFT_CHARS) return null
  try {
    const parsed = envelope.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.savedAt > now + 60_000 || now - parsed.data.savedAt > DRAFT_TTL_MS) return null
    return parsed.data
  } catch { return null }
}

export function writeWorkspaceDraft(storage: Pick<Storage, 'setItem' | 'removeItem'>, key: string, workspace: WorkspaceDraft, now = Date.now()) {
  try {
    if (!workspace.route && !workspace.waypoints.length) { storage.removeItem(key); return true }
    const value = JSON.stringify({ version: 1, savedAt: now, workspace })
    if (value.length > MAX_DRAFT_CHARS || !workspaceSchema.safeParse(workspace).success) return false
    storage.setItem(key, value)
    return true
  } catch { return false }
}
