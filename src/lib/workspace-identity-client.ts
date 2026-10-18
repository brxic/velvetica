'use client'

import { authenticatedFetch } from './auth-client'

let inFlight: Promise<{ storageScope: string }> | null = null

// Share initial identity resolution so parallel requests cannot create different
// anonymous cookies on a first visit. No identity is cached after completion.
export function resolveWorkspaceIdentity() {
  if (!inFlight) {
    const operation = authenticatedFetch('/api/workspace', { cache: 'no-store', signal: AbortSignal.timeout(8_000) }).then(async (response) => {
      if (!response.ok) throw new Error('IDENTITY_UNVERIFIED')
      return await response.json() as { storageScope: string }
    })
    inFlight = operation
    void operation.finally(() => { if (inFlight === operation) inFlight = null }).catch(() => undefined)
  }
  return inFlight
}

export function invalidateWorkspaceIdentity() { inFlight = null }
