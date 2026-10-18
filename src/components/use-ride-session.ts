'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlannedRoute } from '@/lib/domain'
import { createRideTrack, locateRidePosition, rideableSource, usableRideFix, type RideFix, type RideProgress } from '@/lib/ride-progress'
import { PWA_UPDATE_CHECK } from '@/lib/pwa'
import { AUTH_STATE_EVENT } from '@/lib/auth-client'

export type RideIssue = 'denied' | 'unavailable' | 'timeout' | 'insecure' | 'unsupported' | 'accuracy' | null

export function useRideSession() {
  const [route, setRoute] = useState<PlannedRoute | null>(null)
  const [fix, setFix] = useState<RideFix | null>(null)
  const [progress, setProgress] = useState<RideProgress | null>(null)
  const [issue, setIssue] = useState<RideIssue>(null)
  const [paused, setPaused] = useState(false)
  const [following, setFollowing] = useState(true)
  const [visible, setVisible] = useState(true)
  const [now, setNow] = useState(0)
  const [retry, setRetry] = useState(0)
  const [keepAwake, setKeepAwake] = useState(false)
  const [wakeState, setWakeState] = useState<'off' | 'held' | 'unavailable'>('off')
  const previousFix = useRef<RideFix | null>(null)
  const previousProgress = useRef<RideProgress | null>(null)
  const track = useMemo(() => route ? createRideTrack(route) : null, [route])

  function start(next: PlannedRoute) {
    if (!rideableSource(next) || createRideTrack(next).totalKm < .02) return
    previousFix.current = null; previousProgress.current = null
    setFix(null); setProgress(null); setIssue(null); setPaused(false); setFollowing(true); setKeepAwake(false)
    setVisible(document.visibilityState === 'visible'); setNow(Date.now()); setRoute(next)
  }
  const stop = useCallback(() => { previousFix.current = null; previousProgress.current = null; setRoute(null); setFix(null); setProgress(null); setKeepAwake(false); setIssue(null) }, [])
  function retryGps() { setIssue(null); setRetry((value) => value + 1) }

  useEffect(() => {
    if (!route) return
    const visibility = () => { setVisible(document.visibilityState === 'visible'); setNow(Date.now()) }
    const vetoUpdate = (event: Event) => event.preventDefault()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener(PWA_UPDATE_CHECK, vetoUpdate)
    window.addEventListener(AUTH_STATE_EVENT, stop)
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener(PWA_UPDATE_CHECK, vetoUpdate); window.removeEventListener(AUTH_STATE_EVENT, stop) }
  }, [route, stop])

  useEffect(() => {
    if (!route || !fix) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, fix.timestamp + 15_001 - Date.now()))
    return () => window.clearTimeout(timer)
  }, [route, fix])

  useEffect(() => {
    if (!track || paused || !visible) return
    if (!window.isSecureContext) { const timer = setTimeout(() => setIssue('insecure'), 0); return () => clearTimeout(timer) }
    if (!navigator.geolocation) { const timer = setTimeout(() => setIssue('unsupported'), 0); return () => clearTimeout(timer) }
    let disposed = false
    const watch = navigator.geolocation.watchPosition((position) => {
      if (disposed) return
      const next: RideFix = { coordinate: [position.coords.longitude, position.coords.latitude], accuracyM: position.coords.accuracy, timestamp: position.timestamp, speedMps: Number.isFinite(position.coords.speed) && position.coords.speed! >= 0 && position.coords.speed! <= 40 ? position.coords.speed : null }
      if (previousFix.current && next.timestamp <= previousFix.current.timestamp) return
      if (!usableRideFix(next, previousFix.current, Date.now())) { setIssue('accuracy'); return }
      const located = locateRidePosition(track, next, previousProgress.current)
      previousFix.current = next; previousProgress.current = located
      setFix(next); setProgress(located); setIssue(null); setNow(Date.now())
    }, (error) => { if (!disposed) setIssue(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable') }, { enableHighAccuracy: true, maximumAge: 3_000, timeout: 15_000 })
    return () => { disposed = true; navigator.geolocation.clearWatch(watch) }
  }, [track, paused, visible, retry])

  useEffect(() => {
    if (!route || !keepAwake || paused || !visible) return
    let disposed = false
    let sentinel: WakeLockSentinel | undefined
    async function acquire() {
      try {
        if (!('wakeLock' in navigator)) throw new Error('unsupported')
        const lock = await navigator.wakeLock.request('screen')
        if (disposed) { await lock.release(); return }
        sentinel = lock; setWakeState('held')
        lock.addEventListener('release', () => { if (!disposed) setWakeState('unavailable') })
      } catch { if (!disposed) setWakeState('unavailable') }
    }
    void acquire()
    return () => { disposed = true; void sentinel?.release().catch(() => {}); setWakeState('off') }
  }, [route, keepAwake, paused, visible])

  const fresh = Boolean(fix && now - fix.timestamp <= 15_000 && !paused && visible && !issue)
  return { route, fix, progress, issue, paused, following, visible, fresh, keepAwake, wakeState, start, stop, retryGps, setPaused, setFollowing, setKeepAwake }
}

export type RideSession = ReturnType<typeof useRideSession>
