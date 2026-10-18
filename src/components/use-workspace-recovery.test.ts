import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceRecovery } from './use-workspace-recovery'
import { AUTH_STATE_EVENT } from '@/lib/auth-client'
import { workspaceDraftKey, writeWorkspaceDraft, type WorkspaceDraft } from '@/lib/workspace-draft'
import { rideTestRoute } from '../../test-fixtures/ride-route'

const { resolveIdentity, invalidate } = vi.hoisted(() => ({ resolveIdentity: vi.fn(), invalidate: vi.fn() }))
vi.mock('@/lib/workspace-identity-client', () => ({ resolveWorkspaceIdentity: resolveIdentity, invalidateWorkspaceIdentity: invalidate }))
const empty: WorkspaceDraft = { route: null, mode: 'round-trip', profile: 'road', distance: 60, preferences: { surface: 'balanced', climbing: 'balanced', safety: 'quiet' }, waypoints: [] }
const edited: WorkspaceDraft = { ...empty, route: rideTestRoute }
beforeEach(() => { localStorage.clear(); resolveIdentity.mockResolvedValue({ storageScope: 'account-a' }); vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers() })

describe('workspace recovery lifecycle', () => {
  it('closing the offer keeps the old draft intact until an explicit decision', async () => {
    writeWorkspaceDraft(localStorage, workspaceDraftKey('account-a'), edited)
    const hook = renderHook(() => useWorkspaceRecovery(empty))
    await act(async () => {})
    act(() => hook.result.current.setOfferOpen(false))
    act(() => vi.advanceTimersByTime(500))
    expect(hook.result.current.pending?.workspace.route?.id).toBe(rideTestRoute.id)
    expect(localStorage.getItem(workspaceDraftKey('account-a'))).toContain(rideTestRoute.name)
    expect(hook.result.current.offerOpen).toBe(false)
  })
  it('offers rather than silently restoring a local route', async () => {
    writeWorkspaceDraft(localStorage, workspaceDraftKey('account-a'), edited)
    const hook = renderHook(() => useWorkspaceRecovery(empty))
    await act(async () => {})
    expect(hook.result.current.pending?.workspace.route?.name).toBe(rideTestRoute.name)
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(localStorage.getItem(workspaceDraftKey('account-a'))).toContain(rideTestRoute.name)
    let restored: WorkspaceDraft | null = null
    act(() => { restored = hook.result.current.takeRecovery(true) })
    expect(restored).toEqual(edited)
  })
  it('writes edits and flushes the latest committed input when hidden', async () => {
    const hook = renderHook(({ workspace }) => useWorkspaceRecovery(workspace), { initialProps: { workspace: empty } })
    await act(async () => {})
    hook.rerender({ workspace: edited })
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(localStorage.getItem(workspaceDraftKey('account-a'))).toContain(rideTestRoute.name)
  })
  it('never offers an account draft to a guest and rejects stale identity replies', async () => {
    writeWorkspaceDraft(localStorage, workspaceDraftKey('account-a'), edited)
    let finish!: (value: { storageScope: string }) => void
    resolveIdentity.mockReturnValueOnce(new Promise((resolve) => { finish = resolve })).mockResolvedValue({ storageScope: 'guest' })
    const hook = renderHook(() => useWorkspaceRecovery(empty))
    act(() => window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT)))
    await act(async () => { vi.advanceTimersByTime(1) })
    await act(async () => finish({ storageScope: 'account-a' }))
    expect(hook.result.current.pending).toBeNull()
    expect(hook.result.current.identityReady).toBe(true)
  })
  it('does not overwrite another tab’s draft and reports the conflict', async () => {
    const hook = renderHook(({ workspace }) => useWorkspaceRecovery(workspace), { initialProps: { workspace: empty } })
    await act(async () => {})
    writeWorkspaceDraft(localStorage, workspaceDraftKey('account-a'), { ...edited, route: { ...rideTestRoute, name: 'Other window' } })
    hook.rerender({ workspace: edited })
    act(() => vi.advanceTimersByTime(300))
    expect(hook.result.current.storageConflict).toBe(true)
    expect(localStorage.getItem(workspaceDraftKey('account-a'))).toContain('Other window')
  })
  it('shows failure when storage is full and never reads before verified identity', async () => {
    resolveIdentity.mockRejectedValueOnce(new Error('offline'))
    const hook = renderHook(() => useWorkspaceRecovery(edited))
    await act(async () => {})
    expect(hook.result.current.identityUnavailable).toBe(true)
    expect(localStorage.length).toBe(0)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    act(() => window.dispatchEvent(new Event('online')))
    await act(async () => {})
    expect(hook.result.current.storageFailed).toBe(true)
  })
})
