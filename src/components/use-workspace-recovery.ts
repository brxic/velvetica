'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AUTH_STATE_EVENT } from '@/lib/auth-client'
import { invalidateWorkspaceIdentity, resolveWorkspaceIdentity } from '@/lib/workspace-identity-client'
import { parseWorkspaceDraft, workspaceDraftKey, writeWorkspaceDraft, type RecoveryDraft, type WorkspaceDraft } from '@/lib/workspace-draft'

/** Local recovery only. No route, home or GPS data is sent to the identity endpoint. */
export function useWorkspaceRecovery(workspace: WorkspaceDraft) {
  const [pending, setPending] = useState<RecoveryDraft | null>(null)
  const [offerOpen, setOfferOpen] = useState(false)
  const [storageFailed, setStorageFailed] = useState(false)
  const [identityReady, setIdentityReady] = useState(false)
  const [identityUnavailable, setIdentityUnavailable] = useState(false)
  const [storageConflict, setStorageConflict] = useState(false)
  const latest = useRef(workspace)
  const key = useRef<string | null>(null)
  const pendingRef = useRef(false)
  const revision = useRef(0)
  const lastWritten = useRef('')
  const observed = useRef<string | null>(null)

  const flush = useCallback(() => {
    if (!key.current || pendingRef.current) return
    const signature = JSON.stringify(latest.current)
    if (signature === lastWritten.current) return
    let ok = false
    try {
      if (localStorage.getItem(key.current) !== observed.current) { setStorageConflict(true); return }
      ok = writeWorkspaceDraft(localStorage, key.current, latest.current)
      if (ok) observed.current = localStorage.getItem(key.current)
    } catch { /* Browser may block access to storage itself. */ }
    if (ok) lastWritten.current = signature
    setStorageFailed(!ok)
  }, [])

  useEffect(() => {
    let disposed = false
    const resolveIdentity = async () => {
      const epoch = ++revision.current
      let identityConfirmed = false
      try {
        const payload = await resolveWorkspaceIdentity()
        const resolvedKey = workspaceDraftKey(payload.storageScope)
        if (disposed || epoch !== revision.current) return
        identityConfirmed = true
        const raw = localStorage.getItem(resolvedKey)
        const recovered = parseWorkspaceDraft(raw)
        key.current = resolvedKey
        observed.current = raw
        lastWritten.current = ''
        // Offer both even if work was entered during identity resolution. The
        // caller confirms before replacing a newer, nonempty workspace.
        if (recovered) {
          pendingRef.current = true; setPending(recovered); setOfferOpen(true)
        } else if (!recovered) {
          localStorage.removeItem(resolvedKey)
          observed.current = null
        }
        setIdentityReady(true)
        setIdentityUnavailable(false)
        if (!pendingRef.current) flush()
      } catch {
        if (!disposed && epoch === revision.current) {
          setIdentityReady(false)
          if (identityConfirmed) setStorageFailed(true)
          else setIdentityUnavailable(true)
        }
      }
    }
    const identityChanged = () => {
      flush()
      invalidateWorkspaceIdentity()
      revision.current++
      key.current = null; pendingRef.current = false; lastWritten.current = ''
      setPending(null); setOfferOpen(false); setIdentityReady(false); setIdentityUnavailable(false); setStorageFailed(false); setStorageConflict(false)
      // Parent clears the workspace in this same event; resolve after that commit.
      window.setTimeout(() => { if (!disposed) void resolveIdentity() }, 0)
    }
    const reconnect = () => { if (!key.current) void resolveIdentity() }
    const hide = () => { if (document.visibilityState === 'hidden') flush() }
    void resolveIdentity()
    window.addEventListener(AUTH_STATE_EVENT, identityChanged)
    window.addEventListener('online', reconnect)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', hide)
    return () => {
      disposed = true; flush()
      window.removeEventListener(AUTH_STATE_EVENT, identityChanged)
      window.removeEventListener('online', reconnect)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [flush])

  useEffect(() => {
    latest.current = workspace
    const timer = window.setTimeout(flush, 250)
    return () => window.clearTimeout(timer)
  }, [workspace, flush, pending])

  function takeRecovery(restore: boolean) {
    const candidate = pending
    // A second tab may have a newer draft. Do not remove its copy when dismissing ours.
    try {
      if (key.current) {
        const current = parseWorkspaceDraft(localStorage.getItem(key.current))
        if (!current || current.savedAt <= (candidate?.savedAt ?? 0)) { localStorage.removeItem(key.current); observed.current = null }
      }
    } catch { setStorageFailed(true) }
    pendingRef.current = false; setPending(null); setOfferOpen(false); lastWritten.current = ''
    return restore ? candidate?.workspace ?? null : null
  }

  return { pending, offerOpen, setOfferOpen, takeRecovery, storageFailed, storageConflict, identityReady, identityUnavailable }
}
