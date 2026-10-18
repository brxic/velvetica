import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRideSession } from './use-ride-session'
import { rideTestRoute } from '../../test-fixtures/ride-route'
import { canApplyPwaUpdate } from '@/lib/pwa'
import { AUTH_STATE_EVENT } from '@/lib/auth-client'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

function setup() {
  vi.useFakeTimers()
  vi.stubGlobal('isSecureContext', true)
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  let success!: PositionCallback, failure!: PositionErrorCallback
  const clearWatch = vi.fn()
  const watchPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => { success = ok; failure = fail; return 7 })
  const release = vi.fn(async () => {})
  const request = vi.fn(async () => ({ release, addEventListener: vi.fn() }))
  vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch }, wakeLock: { request } })
  const hook = renderHook(() => useRideSession())
  return { ...hook, visibility, clearWatch, watchPosition, release, request, success: (accuracy = 5) => act(() => success({ coords: { latitude: 46.95, longitude: 7.445, accuracy, speed: null }, timestamp: Date.now() } as GeolocationPosition)), failure: (code: number) => act(() => failure({ code } as GeolocationPositionError)) }
}

describe('ride session lifecycle', () => {
  it('requests location only after explicit start; pausing and stopping release the watcher', () => {
    const session = setup()
    expect(session.watchPosition).not.toHaveBeenCalled()
    act(() => session.result.current.start(rideTestRoute))
    expect(session.watchPosition).toHaveBeenCalledTimes(1)
    expect(canApplyPwaUpdate()).toBe(false)
    session.success()
    expect(session.result.current.fresh).toBe(true)
    expect(session.result.current.progress?.remainingAscentM).toBe(20)
    act(() => session.result.current.setPaused(true))
    expect(session.clearWatch).toHaveBeenCalledWith(7)
    expect(session.result.current.fresh).toBe(false)
    act(() => session.result.current.stop())
    expect(canApplyPwaUpdate()).toBe(true)
  })
  it('keeps permission errors actionable and refuses inaccurate positions', () => {
    const session = setup()
    act(() => session.result.current.start(rideTestRoute))
    session.failure(1)
    expect(session.result.current.issue).toBe('denied')
    act(() => session.result.current.retryGps())
    expect(session.watchPosition).toHaveBeenCalledTimes(2)
    session.success(200)
    expect(session.result.current.fix).toBeNull()
    expect(session.result.current.issue).toBe('accuracy')
    session.success()
    act(() => vi.advanceTimersByTime(20_000))
    expect(session.result.current.fresh).toBe(false)
  })
  it('suspends GPS in the background and releases an acquired screen lock', async () => {
    const session = setup()
    act(() => session.result.current.start(rideTestRoute))
    await act(async () => session.result.current.setKeepAwake(true))
    expect(session.result.current.wakeState).toBe('held')
    session.visibility.mockReturnValue('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(session.clearWatch).toHaveBeenCalledTimes(1)
    expect(session.release).toHaveBeenCalledTimes(1)
    session.visibility.mockReturnValue('visible')
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(session.watchPosition).toHaveBeenCalledTimes(2)
    expect(session.request).toHaveBeenCalledTimes(2)
    session.unmount()
    expect(session.release).toHaveBeenCalledTimes(2)
  })
  it('keeps GPS working when the optional wake lock is refused', async () => {
    const session = setup()
    session.request.mockRejectedValue(new Error('battery saver'))
    act(() => session.result.current.start(rideTestRoute))
    session.success()
    await act(async () => session.result.current.setKeepAwake(true))
    expect(session.result.current.wakeState).toBe('unavailable')
    expect(session.result.current.fresh).toBe(true)
  })
  it('stops GPS and clears the live position when account identity changes', () => {
    const session = setup()
    act(() => session.result.current.start(rideTestRoute))
    session.success()
    act(() => window.dispatchEvent(new Event(AUTH_STATE_EVENT)))
    expect(session.result.current.route).toBeNull()
    expect(session.result.current.fix).toBeNull()
    expect(session.clearWatch).toHaveBeenCalledTimes(1)
  })
})
