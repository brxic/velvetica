'use client'

import { LocateFixed, Pause, Play, X } from 'lucide-react'
import type { Locale } from '@/lib/domain'
import type { RideSession, RideIssue } from './use-ride-session'
import { Button } from './ui/button'

const messages: Record<Exclude<RideIssue, null>, [string, string]> = {
  denied: ['Standortzugriff blockiert. Erlaube ihn in den Website-Einstellungen deines Browsers.', 'Location access blocked. Allow it in your browser’s site settings.'],
  unavailable: ['Standort nicht verfügbar. Prüfe dein GPS und versuche es erneut.', 'Location unavailable. Check GPS and try again.'],
  timeout: ['GPS braucht länger. Suche einen Ort mit freier Sicht zum Himmel.', 'GPS is taking longer. Move to an open area.'],
  insecure: ['GPS benötigt HTTPS oder localhost.', 'GPS requires HTTPS or localhost.'],
  unsupported: ['Dieser Browser stellt keinen Standort bereit.', 'This browser does not provide location access.'],
  accuracy: ['GPS zu ungenau oder Positionssprung erkannt. Fortschritt wird nicht aktualisiert.', 'GPS inaccurate or position jump detected. Progress is not updated.'],
}

export function RidePanel({ session, locale }: { session: RideSession; locale: Locale }) {
  const de = locale === 'de', route = session.route
  if (!route) return null
  const { progress, fix, fresh, issue } = session
  const status = session.paused ? (de ? 'GPS pausiert' : 'GPS paused') : !session.visible ? (de ? 'App im Hintergrund. GPS pausiert.' : 'App in background. GPS paused.') : issue ? messages[issue][de ? 0 : 1] : !fix ? (de ? 'GPS-Position wird gesucht' : 'Finding GPS position') : !fresh ? (de ? 'GPS-Position veraltet. Warte auf ein neues Signal.' : 'Location is stale. Waiting for a new signal.') : progress?.arrived ? (de ? 'Ziel erreicht' : 'Destination reached') : progress?.offRoute ? (de ? 'Abseits der Route. Es erfolgt keine automatische Neuberechnung.' : 'Off route. Automatic rerouting is not available.') : (de ? `Auf der Route · GPS ±${Math.round(fix.accuracyM)} m` : `On route · GPS ±${Math.round(fix.accuracyM)} m`)
  const distance = (value: number) => value < 1 ? `${Math.round(value * 1000)} m` : `${value.toLocaleString(de ? 'de-CH' : 'en-GB', { maximumFractionDigits: 1 })} km`
  return <>
    <header className="ride-header"><div><span>{de ? 'Fahrmodus' : 'Ride mode'}</span><strong>{route.name}</strong></div><Button variant="icon" id="ride-exit" onClick={() => { session.stop(); window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.ride-start-button')?.focus()) }} aria-label={de ? 'Fahrmodus beenden' : 'End ride mode'}><X size={20} /></Button></header>
    <section className="ride-panel" aria-label={de ? 'Fahrtübersicht' : 'Ride overview'}>
      <p className={`ride-status ${!fresh || progress?.offRoute ? 'is-warning' : ''}`} role="status" aria-live="polite">{status}</p>
      <div className={`ride-metrics ${!fresh ? 'is-stale' : ''}`} aria-label={!fresh ? (de ? 'Letzter bekannter Fortschritt' : 'Last known progress') : undefined}>
        <div><span>{de ? 'Verbleibend' : 'Remaining'}</span><strong>{progress ? distance(progress.remainingKm) : '—'}</strong></div>
        <div><span>{de ? 'Restanstieg ca.' : 'Ascent left, approx.'}</span><strong>{progress?.remainingAscentM != null ? `${progress.remainingAscentM} m` : '—'}</strong></div>
        <div><span>{de ? 'Restzeit ca.' : 'Time left, approx.'}</span><strong>{progress?.remainingMinutes != null ? `${progress.remainingMinutes} min` : '—'}</strong></div>
      </div>
      <div className="ride-progress" role="progressbar" aria-label={de ? 'Routenfortschritt' : 'Route progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ? Math.round(progress.distanceKm / Math.max(.001, progress.distanceKm + progress.remainingKm) * 100) : 0}><span style={{ width: `${progress ? progress.distanceKm / Math.max(.001, progress.distanceKm + progress.remainingKm) * 100 : 0}%` }} /></div>
      <div className="ride-controls"><Button onClick={() => session.setFollowing(true)} disabled={!fresh} aria-pressed={session.following}><LocateFixed size={18} />{session.following ? (de ? 'Karte folgt' : 'Following') : (de ? 'Zentrieren' : 'Recenter')}</Button><Button onClick={() => { session.setPaused(!session.paused); if (session.paused) session.retryGps() }}>{session.paused ? <Play size={18} /> : <Pause size={18} />}{session.paused ? (de ? 'Fortsetzen' : 'Resume') : (de ? 'Pausieren' : 'Pause')}</Button></div>
      {issue && !session.paused && issue !== 'unsupported' && issue !== 'insecure' ? <Button variant="text" onClick={session.retryGps}>{de ? 'GPS erneut versuchen' : 'Retry GPS'}</Button> : null}
      <label className="ride-awake"><input type="checkbox" checked={session.keepAwake} onChange={(event) => session.setKeepAwake(event.target.checked)} />{de ? 'Bildschirm wach halten' : 'Keep screen awake'}<span aria-live="polite">{session.keepAwake ? session.wakeState === 'held' ? (de ? 'Aktiv' : 'Active') : (de ? 'Nicht aktiv' : 'Not active') : null}</span></label>
      <p className="ride-note">{de ? 'Keine Abbiegehinweise. Zum Bedienen anhalten. Bei gesperrtem Bildschirm kann GPS aussetzen.' : 'No turn-by-turn directions. Stop before using controls. GPS may stop when the screen locks.'}</p>
    </section>
  </>
}
