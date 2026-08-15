'use client'

import Image from 'next/image'
import { Bike, Bookmark, Check, ChevronDown, CircleHelp, Clock3, Copy, Download, Languages, MapPin, Menu, Moon, Mountain, Navigation, Redo2, RotateCcw, Route as RouteIcon, Save, Search, Sparkles, Star, Sun, Trash2, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import logoLight from '../../velvetia-full-light.png'
import logoDark from '../../velvetia-full-dark.png'
import markLight from '../../velvetia-light.png'
import markDark from '../../velvetia-dark.png'
import type { BikeProfile, Locale, PlannedRoute, RouteMode, RoutePreferences, Waypoint } from '@/lib/domain'
import { downloadGpx } from '@/lib/gpx'
import { t } from '@/lib/i18n'
import { MapCanvas } from './map-canvas'
import { Onboarding } from './onboarding'
import { ElevationProfile } from './elevation-profile'
import { PlaceSearch } from './place-search'
import { initialWaypointHistory, waypointHistoryReducer } from '@/lib/waypoint-history'
import { RouteProvenance } from './route-provenance'

const STORAGE_KEY = 'velvetia.saved-routes.v1'
const GUIDE_KEY = 'velvetia.guide-seen.v1'
const THEME_KEY = 'velvetia.theme.v1'

const profiles: Array<{ id: BikeProfile; icon: typeof Bike }> = [
  { id: 'road', icon: Bike }, { id: 'gravel', icon: RouteIcon }, { id: 'touring', icon: Navigation }, { id: 'city', icon: MapPin },
]

function formatDuration(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h} h ${String(m).padStart(2, '0')} min` }

export function PlannerApp() {
  const [locale, setLocale] = useState<Locale>('de'); const copy = t(locale)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mode, setMode] = useState<RouteMode>('round-trip'); const [profile, setProfile] = useState<BikeProfile>('road')
  const [distance, setDistance] = useState(60); const [waypointHistory, dispatchWaypoints] = useReducer(waypointHistoryReducer, initialWaypointHistory)
  const waypoints = waypointHistory.present
  const [preferences, setPreferences] = useState<RoutePreferences>({ surface: 'balanced', climbing: 'balanced', safety: 'quiet' })
  const [route, setRoute] = useState<PlannedRoute | null>(null); const [savedRoutes, setSavedRoutes] = useState<PlannedRoute[]>([])
  const [isPlanning, setIsPlanning] = useState(false); const [notice, setNotice] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false); const [showSaved, setShowSaved] = useState(false); const [mobilePanel, setMobilePanel] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [savedSearch, setSavedSearch] = useState('')

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      try { setSavedRoutes(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')); setShowGuide(!localStorage.getItem(GUIDE_KEY)); setTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light') } catch { setSavedRoutes([]) }
    }, 0)
    return () => window.clearTimeout(hydration)
  }, [])

  const handleMapClick = useCallback((longitude: number, latitude: number) => {
    setNotice(null); setRoute(null)
    let next: Waypoint[]
    if (!waypoints.some((point) => point.kind === 'start')) next = [{ id: crypto.randomUUID(), coordinate: [longitude, latitude], label: copy.start, kind: 'start' }]
    else if (mode === 'one-way' && !waypoints.some((point) => point.kind === 'end')) next = [...waypoints, { id: crypto.randomUUID(), coordinate: [longitude, latitude], label: copy.destination, kind: 'end' }]
    else next = [...waypoints, { id: crypto.randomUUID(), coordinate: [longitude, latitude], label: `Via ${waypoints.length}`, kind: 'via' }]
    dispatchWaypoints({ type: 'commit', waypoints: next })
  }, [copy.destination, copy.start, mode, waypoints])

  async function requestRoute(points: Waypoint[]) {
    const valid = points.some((point) => point.kind === 'start') && (mode === 'round-trip' || points.some((point) => point.kind === 'end'))
    if (!valid) { setNotice(copy.noStart); return }
    setIsPlanning(true); setNotice(null)
    try {
      const response = await fetch('/api/routes/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale, profile, mode, targetDistanceKm: distance, waypoints: points, preferences }) })
      if (!response.ok) throw new Error('Planning failed')
      setRoute(await response.json()); setMobilePanel(false)
    } catch { setNotice(locale === 'de' ? 'Die Route konnte nicht berechnet werden.' : 'The route could not be planned.') }
    finally { setIsPlanning(false) }
  }

  async function planRoute() { await requestRoute(waypoints) }

  function handleWaypointMove(id: string, longitude: number, latitude: number) {
    const next = waypoints.map((point) => point.id === id ? { ...point, coordinate: [longitude, latitude] as [number, number] } : point)
    dispatchWaypoints({ type: 'commit', waypoints: next })
    if (route) void requestRoute(next)
  }

  function persistSaved(next: PlannedRoute[]) { setSavedRoutes(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }

  function saveRoute() {
    if (!route) return
    const next = [route, ...savedRoutes.filter((saved) => saved.id !== route.id)].slice(0, 50)
    persistSaved(next); setNotice(locale === 'de' ? 'Route lokal gespeichert.' : 'Route saved locally.')
  }

  function reset() { setRoute(null); dispatchWaypoints({ type: 'reset' }); setNotice(null); setMobilePanel(true) }
  function closeGuide() { setShowGuide(false); localStorage.setItem(GUIDE_KEY, 'true') }

  const waypointSummary = useMemo(() => waypoints.map((point) => `${point.label}: ${point.coordinate[1].toFixed(4)}, ${point.coordinate[0].toFixed(4)}`), [waypoints])
  const startPoint = waypoints.find((point) => point.kind === 'start')
  const endPoint = waypoints.find((point) => point.kind === 'end')
  function selectPlace(kind: 'start' | 'end', place: { label: string; coordinate: [number, number] }) {
    setRoute(null); setNotice(null)
    const next = waypoints.filter((point) => point.kind !== kind)
    dispatchWaypoints({ type: 'commit', waypoints: [...next, { id: crypto.randomUUID(), coordinate: place.coordinate, label: place.label, kind }] })
  }
  function clearPlace(kind: 'start' | 'end') { setRoute(null); dispatchWaypoints({ type: 'commit', waypoints: waypoints.filter((point) => point.kind !== kind) }) }
  function removeWaypoint(id: string) { setRoute(null); dispatchWaypoints({ type: 'commit', waypoints: waypoints.filter((point) => point.id !== id) }) }
  function undoWaypoints() { if (!waypointHistory.past.length) return; setRoute(null); dispatchWaypoints({ type: 'undo' }) }
  function redoWaypoints() { if (!waypointHistory.future.length) return; setRoute(null); dispatchWaypoints({ type: 'redo' }) }

  const visibleSavedRoutes = savedRoutes
    .filter((saved) => saved.name.toLocaleLowerCase(locale).includes(savedSearch.trim().toLocaleLowerCase(locale)))
    .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)))

  function toggleTheme() { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); localStorage.setItem(THEME_KEY, next) }

  return <main className={`app-shell theme-${theme}`}>
    <MapCanvas activeRoute={route} savedRoutes={savedRoutes} waypoints={waypoints} onMapClick={handleMapClick} onWaypointMove={handleWaypointMove} locale={locale} />

    <header className="topbar">
      <button className="brand" onClick={reset} aria-label={locale === 'de' ? 'Velvetia Startseite' : 'Velvetia home'}>
        <Image className="brand-full" src={theme === 'light' ? logoLight : logoDark} alt="Velvetia" priority />
        <Image className="brand-mark" src={theme === 'light' ? markLight : markDark} alt="" priority />
      </button>
      <nav aria-label={locale === 'de' ? 'Hauptnavigation' : 'Main navigation'}>
        <button className="nav-button is-active"><RouteIcon size={18} /> {copy.planner}</button>
        <button className="nav-button" onClick={() => setShowSaved(true)}><Bookmark size={18} /> {copy.saved}<span className="count">{savedRoutes.length}</span></button>
      </nav>
      <div className="topbar-actions">
        <button className="icon-button labelled" onClick={() => setShowGuide(true)}><CircleHelp size={19} /><span>{copy.guide}</span></button>
        <button className="icon-button" onClick={toggleTheme} aria-label={theme === 'light' ? (locale === 'de' ? 'Dunkles Design' : 'Dark theme') : (locale === 'de' ? 'Helles Design' : 'Light theme')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
        <button className="icon-button" onClick={() => setLocale(locale === 'de' ? 'en' : 'de')} aria-label={locale === 'de' ? 'Sprache wechseln' : 'Switch language'}><Languages size={19} /><b>{locale.toUpperCase()}</b></button>
      </div>
    </header>

    <button className="mobile-panel-toggle" onClick={() => setMobilePanel(!mobilePanel)} aria-label={locale === 'de' ? 'Planungsmenü öffnen' : 'Open planning menu'}>{mobilePanel ? <X /> : <Menu />}</button>

    <aside className={`planner-panel ${mobilePanel ? 'is-open' : ''}`} aria-label={locale === 'de' ? 'Routeneinstellungen' : 'Route settings'}>
      <div className="panel-intro"><p className="eyebrow">{locale === 'de' ? 'Schweizer Routenplaner' : 'Swiss route planner'}</p><h1>{locale === 'de' ? 'Wohin möchtest du fahren?' : 'Where do you want to ride?'}</h1><p>{locale === 'de' ? 'Suche einen Ort oder setze Punkte direkt auf der Karte. Den Rest übernimmt Velvetia.' : 'Search for a place or choose points on the map. Velvetia takes care of the rest.'}</p></div>

      <div className="segmented-control" aria-label={locale === 'de' ? 'Routentyp' : 'Route type'}>
        <button className={mode === 'round-trip' ? 'is-active' : ''} onClick={() => { setMode('round-trip'); setRoute(null); dispatchWaypoints({ type: 'commit', waypoints: waypoints.filter((p) => p.kind === 'start') }) }}>{copy.roundTrip}</button>
        <button className={mode === 'one-way' ? 'is-active' : ''} onClick={() => { setMode('one-way'); setRoute(null); dispatchWaypoints({ type: 'commit', waypoints: waypoints.filter((p) => p.kind === 'start') }) }}>{copy.oneWay}</button>
      </div>

      <section className="form-section">
        <div className="section-heading"><span>01</span><h2>{copy.start}{mode === 'one-way' ? ` & ${copy.destination}` : ''}</h2></div>
        <div className="place-searches">
          <PlaceSearch kind="start" locale={locale} value={startPoint?.label} onSelect={(place) => selectPlace('start', place)} onClear={() => clearPlace('start')} />
          {mode === 'one-way' && <PlaceSearch kind="end" locale={locale} value={endPoint?.label} onSelect={(place) => selectPlace('end', place)} onClear={() => clearPlace('end')} />}
        </div>
        <div className="location-list">
          {waypointSummary.length ? waypointSummary.map((text, index) => <div className="location-row" key={waypoints[index].id}><span className={`location-dot ${waypoints[index].kind}`} /> <span>{text}</span><button onClick={() => removeWaypoint(waypoints[index].id)} aria-label={`${waypoints[index].label} ${locale === 'de' ? 'entfernen' : 'remove'}`}><X size={14} /></button></div>) : <button className="map-prompt"><MapPin size={18} /> {copy.mapHint}</button>}
        </div>
        <div className="editor-toolbar" aria-label={locale === 'de' ? 'Bearbeitungsverlauf' : 'Edit history'}>
          <button onClick={undoWaypoints} disabled={!waypointHistory.past.length}><Undo2 size={15} />{locale === 'de' ? 'Rückgängig' : 'Undo'}</button>
          <button onClick={redoWaypoints} disabled={!waypointHistory.future.length}><Redo2 size={15} />{locale === 'de' ? 'Wiederholen' : 'Redo'}</button>
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
          ['quiet', locale === 'de' ? 'Ruhige Strassen' : 'Quiet roads'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['direct', locale === 'de' ? 'Möglichst direkt' : 'Most direct'],
        ]} />
      </div>}
    </aside>

    {route && <section className="route-summary" aria-label={locale === 'de' ? 'Routenzusammenfassung' : 'Route summary'}>
      <div className="route-summary-head"><div><p className="eyebrow">{copy.routeReady}</p><input className="route-name-input" value={route.name} maxLength={80} aria-label={locale === 'de' ? 'Routenname' : 'Route name'} onChange={(event) => setRoute({ ...route, name: event.target.value })} /></div><span className={`preview-badge ${route.metrics.confidence === 'verified' ? 'is-verified' : ''}`}>{route.metrics.confidence === 'verified' ? (locale === 'de' ? 'OSM-Routing' : 'OSM routing') : copy.preview}</span></div>
      <div className="metric-grid">
        <div><RouteIcon /><span>{copy.distanceLabel}</span><strong>{route.metrics.distanceKm} km</strong></div>
        <div><Clock3 /><span>{copy.time}</span><strong>{formatDuration(route.metrics.durationMinutes)}</strong></div>
        <div><Mountain /><span>{copy.elevation}</span><strong>{route.metrics.elevationGainM} m</strong></div>
        <div><Bike /><span>{copy.surface}</span><strong>{route.metrics.asphaltPercent} %</strong></div>
      </div>
      <div className="route-detail-grid">
        <ElevationProfile metrics={route.metrics} locale={locale} />
        <div className="surface-card"><div><span>{locale === 'de' ? 'Untergrund' : 'Surface'}</span><strong>{route.metrics.asphaltPercent}% {locale === 'de' ? 'Asphalt' : 'paved'}</strong></div><div className="surface-track"><i style={{ width: `${route.metrics.asphaltPercent}%` }} /></div><small>{route.metrics.cyclewayPercent}% {locale === 'de' ? 'geschätzter Radweganteil' : 'estimated cycleway share'}</small></div>
      </div>
      {route.warnings.length > 0 && <ul className="warning-list">{route.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <RouteProvenance provenance={route.provenance} locale={locale} />
      <p className="preview-note">{route.metrics.confidence === 'verified' ? (locale === 'de' ? 'Straßengenau berechnet mit dem lokalen Schweizer Valhalla-Routinggraphen.' : 'Road-accurate route calculated with the local Swiss Valhalla routing graph.') : copy.previewInfo}</p>
      <div className="route-actions"><button className="secondary-button" onClick={saveRoute}><Save size={17} />{copy.save}</button><button className="primary-button" onClick={() => downloadGpx(route)}><Download size={17} />{copy.export}</button><button className="icon-button" onClick={reset} aria-label={copy.clear}><RotateCcw size={18} /></button></div>
    </section>}

    {showSaved && <div className="drawer-backdrop" onClick={() => setShowSaved(false)}><aside className="saved-drawer" onClick={(event) => event.stopPropagation()}>
      <div className="drawer-head"><div><p className="eyebrow">Velvetia</p><h2>{copy.saved}</h2></div><button className="icon-button" onClick={() => setShowSaved(false)} aria-label={locale === 'de' ? 'Schliessen' : 'Close'}><X /></button></div>
      {savedRoutes.length > 0 && <label className="saved-search"><Search size={16} /><span className="sr-only">{locale === 'de' ? 'Routen suchen' : 'Search routes'}</span><input value={savedSearch} onChange={(event) => setSavedSearch(event.target.value)} placeholder={locale === 'de' ? 'Routen suchen' : 'Search routes'} /></label>}
      {savedRoutes.length === 0 ? <div className="empty-state"><Bookmark size={28} /><h3>{locale === 'de' ? 'Noch keine Routen' : 'No routes yet'}</h3><p>{locale === 'de' ? 'Gespeicherte Routen erscheinen hier und als dezente Ebene auf der Karte.' : 'Saved routes appear here and as a subtle layer on the map.'}</p></div> : visibleSavedRoutes.length === 0 ? <div className="empty-state"><Search size={28} /><h3>{locale === 'de' ? 'Nichts gefunden' : 'Nothing found'}</h3></div> : <div className="saved-list">{visibleSavedRoutes.map((saved) => <article key={saved.id}>
        <button className="saved-main" onClick={() => { setRoute(saved); dispatchWaypoints({ type: 'reset', waypoints: saved.waypoints }); setMode(saved.mode); setProfile(saved.profile); setShowSaved(false) }}><span className="saved-route-icon"><RouteIcon /></span><span><strong>{saved.name}</strong><small>{saved.metrics.distanceKm} km · {formatDuration(saved.metrics.durationMinutes)}</small></span><ChevronDown className="saved-chevron" /></button>
        <div className="saved-actions">
          <button className={saved.favorite ? 'is-favorite' : ''} onClick={() => persistSaved(savedRoutes.map((item) => item.id === saved.id ? { ...item, favorite: !item.favorite } : item))} aria-label={locale === 'de' ? 'Favorit umschalten' : 'Toggle favorite'}><Star size={15} fill={saved.favorite ? 'currentColor' : 'none'} /></button>
          <button onClick={() => persistSaved([{ ...saved, id: crypto.randomUUID(), name: `${saved.name} ${locale === 'de' ? 'Kopie' : 'copy'}`, createdAt: new Date().toISOString(), favorite: false }, ...savedRoutes].slice(0, 50))} aria-label={locale === 'de' ? 'Route duplizieren' : 'Duplicate route'}><Copy size={15} /></button>
          <button onClick={() => persistSaved(savedRoutes.filter((item) => item.id !== saved.id))} aria-label={locale === 'de' ? 'Route löschen' : 'Delete route'}><Trash2 size={15} /></button>
        </div>
      </article>)}</div>}
    </aside></div>}
    {showGuide && <Onboarding onClose={closeGuide} locale={locale} />}

    <footer className="font-credit">Fonts made from <a href="http://www.onlinewebfonts.com" target="_blank" rel="noreferrer">Web Fonts</a> is licensed by CC BY 4.0</footer>
  </main>
}

function PreferenceSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Array<[T, string]> }) {
  return <label className="preference-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>
}
