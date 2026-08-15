'use client'

import Image from 'next/image'
import { Bike, Bookmark, Check, ChevronDown, CircleHelp, Clock3, Download, Languages, MapPin, Menu, Mountain, Navigation, RotateCcw, Route as RouteIcon, Save, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import logoLight from '../../velvetia-full-light.png'
import type { BikeProfile, Locale, PlannedRoute, RouteMode, RoutePreferences, Waypoint } from '@/lib/domain'
import { downloadGpx } from '@/lib/gpx'
import { t } from '@/lib/i18n'
import { MapCanvas } from './map-canvas'
import { Onboarding } from './onboarding'
import { ElevationProfile } from './elevation-profile'
import { PlaceSearch } from './place-search'

const STORAGE_KEY = 'velvetia.saved-routes.v1'
const GUIDE_KEY = 'velvetia.guide-seen.v1'

const profiles: Array<{ id: BikeProfile; icon: typeof Bike }> = [
  { id: 'road', icon: Bike }, { id: 'gravel', icon: RouteIcon }, { id: 'touring', icon: Navigation }, { id: 'city', icon: MapPin },
]

function formatDuration(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h} h ${String(m).padStart(2, '0')} min` }

export function PlannerApp() {
  const [locale, setLocale] = useState<Locale>('de'); const copy = t(locale)
  const [mode, setMode] = useState<RouteMode>('round-trip'); const [profile, setProfile] = useState<BikeProfile>('road')
  const [distance, setDistance] = useState(60); const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [preferences, setPreferences] = useState<RoutePreferences>({ surface: 'balanced', climbing: 'balanced', safety: 'quiet' })
  const [route, setRoute] = useState<PlannedRoute | null>(null); const [savedRoutes, setSavedRoutes] = useState<PlannedRoute[]>([])
  const [isPlanning, setIsPlanning] = useState(false); const [notice, setNotice] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false); const [showSaved, setShowSaved] = useState(false); const [mobilePanel, setMobilePanel] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      try { setSavedRoutes(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')); setShowGuide(!localStorage.getItem(GUIDE_KEY)) } catch { setSavedRoutes([]) }
    }, 0)
    return () => window.clearTimeout(hydration)
  }, [])

  const handleMapClick = useCallback((longitude: number, latitude: number) => {
    setNotice(null); setRoute(null)
    setWaypoints((current) => {
      if (!current.some((point) => point.kind === 'start')) return [{ id: crypto.randomUUID(), coordinate: [longitude, latitude], label: copy.start, kind: 'start' }]
      if (mode === 'one-way' && !current.some((point) => point.kind === 'end')) return [...current, { id: crypto.randomUUID(), coordinate: [longitude, latitude], label: copy.destination, kind: 'end' }]
      return [...current, { id: crypto.randomUUID(), coordinate: [longitude, latitude], label: `Via ${current.length}`, kind: 'via' }]
    })
  }, [copy.destination, copy.start, mode])

  async function requestRoute(points: Waypoint[]) {
    const valid = points.some((point) => point.kind === 'start') && (mode === 'round-trip' || points.some((point) => point.kind === 'end'))
    if (!valid) { setNotice(copy.noStart); return }
    setIsPlanning(true); setNotice(null)
    try {
      const response = await fetch('/api/routes/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, mode, targetDistanceKm: distance, waypoints: points, preferences }) })
      if (!response.ok) throw new Error('Planning failed')
      setRoute(await response.json()); setMobilePanel(false)
    } catch { setNotice(locale === 'de' ? 'Die Route konnte nicht berechnet werden.' : 'The route could not be planned.') }
    finally { setIsPlanning(false) }
  }

  async function planRoute() { await requestRoute(waypoints) }

  function handleWaypointMove(id: string, longitude: number, latitude: number) {
    const next = waypoints.map((point) => point.id === id ? { ...point, coordinate: [longitude, latitude] as [number, number] } : point)
    setWaypoints(next)
    if (route) void requestRoute(next)
  }

  function saveRoute() {
    if (!route) return
    const next = [route, ...savedRoutes.filter((saved) => saved.id !== route.id)].slice(0, 50)
    setSavedRoutes(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setNotice(locale === 'de' ? 'Route lokal gespeichert.' : 'Route saved locally.')
  }

  function reset() { setRoute(null); setWaypoints([]); setNotice(null); setMobilePanel(true) }
  function closeGuide() { setShowGuide(false); localStorage.setItem(GUIDE_KEY, 'true') }

  const waypointSummary = useMemo(() => waypoints.map((point) => `${point.label}: ${point.coordinate[1].toFixed(4)}, ${point.coordinate[0].toFixed(4)}`), [waypoints])
  const startPoint = waypoints.find((point) => point.kind === 'start')
  const endPoint = waypoints.find((point) => point.kind === 'end')
  function selectPlace(kind: 'start' | 'end', place: { label: string; coordinate: [number, number] }) {
    setRoute(null); setNotice(null)
    setWaypoints((points) => {
      const next = points.filter((point) => point.kind !== kind)
      return [...next, { id: crypto.randomUUID(), coordinate: place.coordinate, label: place.label, kind }]
    })
  }
  function clearPlace(kind: 'start' | 'end') { setRoute(null); setWaypoints((points) => points.filter((point) => point.kind !== kind)) }

  return <main className="app-shell">
    <MapCanvas activeRoute={route} savedRoutes={savedRoutes} waypoints={waypoints} onMapClick={handleMapClick} onWaypointMove={handleWaypointMove} />

    <header className="topbar">
      <button className="brand" onClick={reset} aria-label="Velvetia Startseite"><Image src={logoLight} alt="Velvetia" priority /></button>
      <nav aria-label="Hauptnavigation">
        <button className="nav-button is-active"><RouteIcon size={18} /> {copy.planner}</button>
        <button className="nav-button" onClick={() => setShowSaved(true)}><Bookmark size={18} /> {copy.saved}<span className="count">{savedRoutes.length}</span></button>
      </nav>
      <div className="topbar-actions">
        <button className="icon-button labelled" onClick={() => setShowGuide(true)}><CircleHelp size={19} /><span>{copy.guide}</span></button>
        <button className="icon-button" onClick={() => setLocale(locale === 'de' ? 'en' : 'de')} aria-label="Sprache wechseln"><Languages size={19} /><b>{locale.toUpperCase()}</b></button>
      </div>
    </header>

    <button className="mobile-panel-toggle" onClick={() => setMobilePanel(!mobilePanel)} aria-label="Planungsmenü öffnen">{mobilePanel ? <X /> : <Menu />}</button>

    <aside className={`planner-panel ${mobilePanel ? 'is-open' : ''}`} aria-label="Routeneinstellungen">
      <div className="panel-intro"><p className="eyebrow">{locale === 'de' ? 'Schweizer Routenplaner' : 'Swiss route planner'}</p><h1>{locale === 'de' ? 'Wohin möchtest du fahren?' : 'Where do you want to ride?'}</h1><p>{locale === 'de' ? 'Suche einen Ort oder setze Punkte direkt auf der Karte. Den Rest übernimmt Velvetia.' : 'Search for a place or choose points on the map. Velvetia takes care of the rest.'}</p></div>

      <div className="segmented-control" aria-label="Routentyp">
        <button className={mode === 'round-trip' ? 'is-active' : ''} onClick={() => { setMode('round-trip'); setRoute(null); setWaypoints((points) => points.filter((p) => p.kind === 'start')) }}>{copy.roundTrip}</button>
        <button className={mode === 'one-way' ? 'is-active' : ''} onClick={() => { setMode('one-way'); setRoute(null); setWaypoints((points) => points.filter((p) => p.kind === 'start')) }}>{copy.oneWay}</button>
      </div>

      <section className="form-section">
        <div className="section-heading"><span>01</span><h2>{copy.start}{mode === 'one-way' ? ` & ${copy.destination}` : ''}</h2></div>
        <div className="place-searches">
          <PlaceSearch kind="start" locale={locale} value={startPoint?.label} onSelect={(place) => selectPlace('start', place)} onClear={() => clearPlace('start')} />
          {mode === 'one-way' && <PlaceSearch kind="end" locale={locale} value={endPoint?.label} onSelect={(place) => selectPlace('end', place)} onClear={() => clearPlace('end')} />}
        </div>
        <div className="location-list">
          {waypointSummary.length ? waypointSummary.map((text, index) => <div className="location-row" key={waypoints[index].id}><span className={`location-dot ${waypoints[index].kind}`} /> <span>{text}</span><Check size={16} /></div>) : <button className="map-prompt"><MapPin size={18} /> {copy.mapHint}</button>}
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading"><span>02</span><h2>{copy.bike}</h2></div>
        <div className="profile-grid">{profiles.map(({ id, icon: Icon }) => <button key={id} className={profile === id ? 'profile-card is-active' : 'profile-card'} onClick={() => setProfile(id)}><Icon size={21} /><span>{copy[id]}</span>{profile === id && <Check size={15} />}</button>)}</div>
      </section>

      <section className="form-section distance-section">
        <div className="section-heading"><span>03</span><h2>{copy.distance}</h2><strong>{distance} km</strong></div>
        <input type="range" min="5" max="250" step="5" value={distance} onChange={(event) => setDistance(Number(event.target.value))} aria-label={`${copy.distance}: ${distance} km`} />
        <div className="range-labels"><span>5 km</span><span>250 km</span></div>
      </section>

      {notice && <div className="notice" role="status">{notice}</div>}
      <button className="primary-button plan-button" onClick={planRoute} disabled={isPlanning}>{isPlanning ? <><span className="spinner" />{copy.planning}</> : <><Sparkles size={19} />{copy.calculate}</>}</button>
      <button className={`advanced-button ${showAdvanced ? 'is-open' : ''}`} onClick={() => setShowAdvanced(!showAdvanced)} aria-expanded={showAdvanced}>{locale === 'de' ? 'Erweiterte Wünsche' : 'Advanced preferences'} <ChevronDown size={17} /></button>
      {showAdvanced && <div className="advanced-panel">
        <PreferenceSelect label={locale === 'de' ? 'Untergrund' : 'Surface'} value={preferences.surface} onChange={(surface) => setPreferences({ ...preferences, surface })} options={[
          ['mostly-paved', locale === 'de' ? 'Möglichst Asphalt' : 'Mostly paved'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['unpaved-friendly', locale === 'de' ? 'Mehr Naturwege' : 'More unpaved'],
        ]} />
        <PreferenceSelect label={locale === 'de' ? 'Steigungen' : 'Climbing'} value={preferences.climbing} onChange={(climbing) => setPreferences({ ...preferences, climbing })} options={[
          ['avoid', locale === 'de' ? 'Eher flach' : 'Prefer flat'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['challenge', locale === 'de' ? 'Herausforderung' : 'Challenge'],
        ]} />
        <PreferenceSelect label={locale === 'de' ? 'Straßenwahl' : 'Road choice'} value={preferences.safety} onChange={(safety) => setPreferences({ ...preferences, safety })} options={[
          ['quiet', locale === 'de' ? 'Ruhig & sicher' : 'Quiet & safer'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['direct', locale === 'de' ? 'Möglichst direkt' : 'Most direct'],
        ]} />
      </div>}
    </aside>

    {route && <section className="route-summary" aria-label="Routenzusammenfassung">
      <div className="route-summary-head"><div><p className="eyebrow">{copy.routeReady}</p><h2>{route.name}</h2></div><span className={`preview-badge ${route.metrics.confidence === 'verified' ? 'is-verified' : ''}`}>{route.metrics.confidence === 'verified' ? (locale === 'de' ? 'OSM-Routing' : 'OSM routing') : copy.preview}</span></div>
      <div className="metric-grid">
        <div><RouteIcon /><span>{copy.distanceLabel}</span><strong>{route.metrics.distanceKm} km</strong></div>
        <div><Clock3 /><span>{copy.time}</span><strong>{formatDuration(route.metrics.durationMinutes)}</strong></div>
        <div><Mountain /><span>{copy.elevation}</span><strong>{route.metrics.elevationGainM} m</strong></div>
        <div><Bike /><span>{copy.surface}</span><strong>{route.metrics.asphaltPercent} %</strong></div>
      </div>
      <div className="route-detail-grid">
        <ElevationProfile metrics={route.metrics} />
        <div className="surface-card"><div><span>Untergrund</span><strong>{route.metrics.asphaltPercent}% Asphalt</strong></div><div className="surface-track"><i style={{ width: `${route.metrics.asphaltPercent}%` }} /></div><small>{route.metrics.cyclewayPercent}% geschätzter Radweganteil</small></div>
      </div>
      {route.warnings.length > 0 && <ul className="warning-list">{route.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <p className="preview-note">{route.metrics.confidence === 'verified' ? (locale === 'de' ? 'Straßengenau berechnet mit dem lokalen Schweizer Valhalla-Routinggraphen.' : 'Road-accurate route calculated with the local Swiss Valhalla routing graph.') : copy.previewInfo}</p>
      <div className="route-actions"><button className="secondary-button" onClick={saveRoute}><Save size={17} />{copy.save}</button><button className="primary-button" onClick={() => downloadGpx(route)}><Download size={17} />{copy.export}</button><button className="icon-button" onClick={reset} aria-label={copy.clear}><RotateCcw size={18} /></button></div>
    </section>}

    {showSaved && <div className="drawer-backdrop" onClick={() => setShowSaved(false)}><aside className="saved-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Velvetia</p><h2>{copy.saved}</h2></div><button className="icon-button" onClick={() => setShowSaved(false)}><X /></button></div>{savedRoutes.length === 0 ? <div className="empty-state"><Bookmark size={28} /><h3>Noch keine Routen</h3><p>Gespeicherte Routen erscheinen hier und als dezente Ebene auf der Karte.</p></div> : <div className="saved-list">{savedRoutes.map((saved) => <button key={saved.id} onClick={() => { setRoute(saved); setWaypoints(saved.waypoints); setShowSaved(false) }}><span className="saved-route-icon"><RouteIcon /></span><span><strong>{saved.name}</strong><small>{saved.metrics.distanceKm} km · {formatDuration(saved.metrics.durationMinutes)}</small></span><ChevronDown className="saved-chevron" /></button>)}</div>}</aside></div>}
    {showGuide && <Onboarding onClose={closeGuide} />}

    <footer className="font-credit">Fonts made from <a href="http://www.onlinewebfonts.com" target="_blank" rel="noreferrer">Web Fonts</a> is licensed by CC BY 4.0</footer>
  </main>
}

function PreferenceSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Array<[T, string]> }) {
  return <label className="preference-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>
}
