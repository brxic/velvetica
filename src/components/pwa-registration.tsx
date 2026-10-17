'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, RefreshCw, WifiOff, X } from 'lucide-react'
import { canApplyPwaUpdate } from '@/lib/pwa'
import { Button } from './ui/button'

export function PwaRegistration() {
  const [online, setOnline] = useState(true)
  const [reconnected, setReconnected] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [applying, setApplying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [locale, setLocale] = useState('de')
  const statusRef = useRef<HTMLElement>(null)
  const applyingRef = useRef(false)
  const activationTimerRef = useRef<number | undefined>(undefined)
  const de = locale.startsWith('de')
  const visible = !online || reconnected || waiting !== null || message !== null || unavailable
  const statusText = !online
    ? (de ? 'Offline · Cloud-Abgleich pausiert. Lokales Speichern bleibt möglich; Karte und neue Routen benötigen Internet.' : 'Offline · Cloud sync paused. Local saving is available; maps and new routes need internet.')
    : message ?? (unavailable ? (de ? 'Offline-Modus nicht eingerichtet. Online funktioniert die App weiterhin.' : 'Offline mode unavailable. The app still works online.') : waiting ? (de ? 'Neue Version bereit. Aktualisiere, wenn dein Entwurf gesichert ist.' : 'New version ready. Update once your draft is saved.') : (de ? 'Netzwerk wieder verbunden. Prüfe bei deinen Routen den Cloud-Status.' : 'Network reconnected. Check your routes’ cloud status.'))

  useEffect(() => () => window.clearTimeout(activationTimerRef.current), [])

  useEffect(() => {
    const offline = () => { setOnline(false); setReconnected(false) }
    const connected = () => { setOnline(true); setReconnected(true) }
    const language = () => setLocale(document.documentElement.lang)
    const timer = window.setTimeout(() => { setOnline(navigator.onLine); language() }, 0)
    const observer = new MutationObserver(language)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    window.addEventListener('online', connected)
    window.addEventListener('offline', offline)
    return () => { window.clearTimeout(timer); observer.disconnect(); window.removeEventListener('online', connected); window.removeEventListener('offline', offline) }
  }, [])

  useEffect(() => {
    const measure = () => document.documentElement.style.setProperty('--pwa-status-height', `${statusRef.current?.getBoundingClientRect().height ?? 0}px`)
    const observer = new ResizeObserver(measure)
    if (statusRef.current) observer.observe(statusRef.current)
    measure()
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--pwa-status-height') }
  }, [visible])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    let disposed = false
    let registration: ServiceWorkerRegistration | undefined
    let controlled = Boolean(navigator.serviceWorker.controller)
    const installers = new Set<ServiceWorker>()
    const detect = () => {
      if (registration?.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting)
      const installing = registration?.installing
      if (installing && !installers.has(installing)) { installers.add(installing); installing.addEventListener('statechange', detect) }
    }
    const changed = () => {
      window.clearTimeout(activationTimerRef.current)
      if (applyingRef.current && canApplyPwaUpdate()) { window.location.reload(); return }
      // Recheck safety: edits may have started while activation was pending.
      if (controlled) {
        applyingRef.current = false; setApplying(false)
        setWaiting(navigator.serviceWorker.controller)
        setMessage(null)
      }
      controlled = true
    }
    const check = () => { if (document.visibilityState === 'visible') void registration?.update().catch(() => undefined) }
    navigator.serviceWorker.addEventListener('controllerchange', changed)
    document.addEventListener('visibilitychange', check)
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((result) => {
      if (disposed) return
      registration = result; registration.addEventListener('updatefound', detect); detect()
      void registration.update().catch(() => undefined)
    }).catch(() => {
      if (!disposed && !navigator.serviceWorker.controller) setUnavailable(true)
    })
    return () => {
      disposed = true
      registration?.removeEventListener('updatefound', detect)
      installers.forEach((worker) => worker.removeEventListener('statechange', detect))
      navigator.serviceWorker.removeEventListener('controllerchange', changed)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  async function applyUpdate() {
    if (!waiting || applyingRef.current) return
    if (!online) { setMessage(de ? 'Verbinde dich für das Update mit dem Internet.' : 'Connect to the internet to update.'); return }
    if (!canApplyPwaUpdate()) { setMessage(de ? 'Speichere oder beende zuerst deinen Entwurf. Laufende Aktionen bitte abwarten.' : 'Save or finish your draft first. Wait for pending actions.'); return }
    if (waiting.state === 'activated') { window.location.reload(); return }
    applyingRef.current = true; setApplying(true); setMessage(null)
    activationTimerRef.current = window.setTimeout(() => {
      applyingRef.current = false; setApplying(false)
      setMessage(de ? 'Update konnte nicht übernommen werden. Dein Entwurf bleibt geöffnet. Versuche es erneut.' : 'Update could not be applied. Your draft stays open. Try again.')
    }, 15_000)
    const channel = new MessageChannel()
    const result = await new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => { channel.port1.close(); resolve(false) }, 8000)
      channel.port1.onmessage = (event) => { window.clearTimeout(timer); channel.port1.close(); resolve(event.data?.type === 'UPDATE_ACCEPTED') }
      try { waiting.postMessage({ type: 'APPLY_UPDATE' }, [channel.port2]) } catch { window.clearTimeout(timer); channel.port1.close(); resolve(false) }
    })
    if (!result) {
      window.clearTimeout(activationTimerRef.current)
      applyingRef.current = false; setApplying(false)
      setMessage(de ? 'Schliesse weitere Velvetia-Tabs und versuche das Update erneut.' : 'Close other Velvetia tabs and try updating again.')
    }
  }

  if (!visible) return null
  return <aside ref={statusRef} className="pwa-status" aria-label={de ? 'App-Status' : 'App status'}>
    <div role="status" aria-live="polite">{!online ? <WifiOff size={18} aria-hidden="true" /> : waiting ? <Download size={18} aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}<span>{statusText}</span></div>
    {waiting ? <Button busy={applying} onClick={() => void applyUpdate()}>{de ? 'Jetzt aktualisieren' : 'Update now'}</Button> : null}
    {online && !waiting ? <Button variant="icon" aria-label={de ? 'Status schliessen' : 'Dismiss status'} onClick={() => { setReconnected(false); setMessage(null); setUnavailable(false) }}><X size={18} /></Button> : null}
  </aside>
}
