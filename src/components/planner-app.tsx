'use client'

import Image from 'next/image'
import { Bike, Bookmark, Check, ChevronDown, CircleHelp, Clock3, Copy, Download, Languages, MapPin, Menu, Moon, Mountain, Navigation, Redo2, RotateCcw, Route as RouteIcon, Save, Search, Sparkles, Star, Sun, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
function routeSignature(route: PlannedRoute) { return JSON.stringify({ name: route.name.trim(), description: route.description ?? '', profile: route.profile, mode: route.mode, geometry: route.geometry, waypoints: route.waypoints.filter((point) => point.kind !== 'generated'), metrics: route.metrics }) }

function ensureEditableAnchors(route: PlannedRoute) {
  if (route.mode !== 'round-trip' || route.waypoints.length !== 1 || route.geometry.coordinates.length < 4) return route
  const coordinates = route.geometry.coordinates
  const generated: Waypoint[] = [.25, .5, .75].map((ratio, index) => ({
    id: `generated-legacy-${route.id}-${index}`,
    coordinate: coordinates[Math.round((coordinates.length - 1) * ratio)] as [number, number],
    label: `Generated anchor ${index + 1}`,
    kind: 'generated',
  }))
  return { ...route, waypoints: [...route.waypoints, ...generated] }
}

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
  const [activeProfileIndex, setActiveProfileIndex] = useState<number | null>(null)
  const routeRequestRef = useRef<AbortController | null>(null)
  const [savedSort, setSavedSort] = useState<'updated' | 'name' | 'distance'>('updated')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [showRouteDetails, setShowRouteDetails] = useState(true)

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      try { setSavedRoutes(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')); setShowGuide(!localStorage.getItem(GUIDE_KEY)); setTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light') } catch { setSavedRoutes([]) }
    }, 0)
    return () => window.clearTimeout(hydration)
  }, [])

  function handleMapClick(longitude: number, latitude: number) {
    setNotice(null)
    let next: Waypoint[]
    if (!waypoints.some((point) => point.kind === 'start')) next = [{ id: crypto.randomUUID(), coordinate: [longitude, latitude], label: copy.start, kind: 'start' }]
    else if (mode === 'one-way' && !waypoints.some((point) => point.kind === 'end')) next = [...waypoints, { id: crypto.randomUUID(), coordinate: [longitude, latitude], label: copy.destination, kind: 'end' }]
    else next = [...waypoints, { id: crypto.randomUUID(), coordinate: [longitude, latitude], label: `Via ${waypoints.length}`, kind: 'via' }]
    dispatchWaypoints({ type: 'commit', waypoints: next })
    if (route) void requestRoute(next, true)
    else setRoute(null)
  }

  async function requestRoute(points: Waypoint[], preserveExisting = false) {
    const valid = points.some((point) => point.kind === 'start') && (mode === 'round-trip' || points.some((point) => point.kind === 'end'))
    if (!valid) { setNotice(copy.noStart); return }
    routeRequestRef.current?.abort()
    const controller = new AbortController(); routeRequestRef.current = controller
    setIsPlanning(true); setNotice(null)
    try {
      const response = await fetch('/api/routes/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale, profile, mode, targetDistanceKm: distance, waypoints: points, preferences }), signal: controller.signal })
      if (!response.ok) throw new Error('Planning failed')
      const planned = await response.json() as PlannedRoute
      setRoute((current) => preserveExisting && current ? { ...planned, id: current.id, name: current.name, description: current.description, createdAt: current.createdAt, updatedAt: current.updatedAt, favorite: current.favorite } : planned)
      if (!preserveExisting && planned.waypoints.some((point) => point.kind === 'generated')) dispatchWaypoints({ type: 'reset', waypoints: planned.waypoints })
      setActiveProfileIndex(null); setMobilePanel(false)
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(locale === 'de' ? 'Die Route konnte nicht berechnet werden.' : 'The route could not be planned.') }
    finally { if (routeRequestRef.current === controller) { routeRequestRef.current = null; setIsPlanning(false) } }
  }

  async function planRoute() { await requestRoute(waypoints, false) }

  function handleWaypointMove(id: string, longitude: number, latitude: number) {
    const next = waypoints.map((point) => point.id === id ? { ...point, coordinate: [longitude, latitude] as [number, number] } : point)
    dispatchWaypoints({ type: 'commit', waypoints: next })
    if (route) void requestRoute(next, true)
  }

  function handleRouteShape(longitude: number, latitude: number, insertionIndex: number) {
    if (!route) return
    const shapingCount = waypoints.filter((point) => point.kind === 'shaping').length + 1
    const point: Waypoint = { id: crypto.randomUUID(), coordinate: [longitude, latitude], label: `${locale === 'de' ? 'Anpassung' : 'Adjustment'} ${shapingCount}`, kind: 'shaping' }
    const next = [...waypoints]; next.splice(insertionIndex, 0, point)
    dispatchWaypoints({ type: 'commit', waypoints: next }); void requestRoute(next, true)
  }

  function persistSaved(next: PlannedRoute[]) { setSavedRoutes(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }

  function saveRoute(asCopy = false) {
    if (!route) return
    const name = route.name.trim()
    if (!name) { setNotice(locale === 'de' ? 'Bitte gib der Route einen Namen.' : 'Please give the route a name.'); return }
    const timestamp = new Date().toISOString()
    const saved: PlannedRoute = asCopy
      ? { ...route, id: crypto.randomUUID(), name: `${name} ${locale === 'de' ? 'Kopie' : 'copy'}`, createdAt: timestamp, updatedAt: timestamp, favorite: false }
      : { ...route, name, updatedAt: timestamp }
    const next = [saved, ...savedRoutes.filter((item) => item.id !== saved.id)].slice(0, 50)
    persistSaved(next); setRoute(saved); setNotice(asCopy ? (locale === 'de' ? 'Als neue Route gespeichert.' : 'Saved as a new route.') : (locale === 'de' ? 'Route lokal gespeichert.' : 'Route saved locally.'))
  }

  function reset() { setRoute(null); dispatchWaypoints({ type: 'reset' }); setNotice(null); setMobilePanel(true) }
  function closeGuide() { setShowGuide(false); localStorage.setItem(GUIDE_KEY, 'true') }

  const visibleWaypoints = useMemo(() => waypoints.filter((point) => point.kind !== 'generated'), [waypoints])
  const waypointSummary = useMemo(() => visibleWaypoints.map((point) => `${point.label}: ${point.coordinate[1].toFixed(4)}, ${point.coordinate[0].toFixed(4)}`), [visibleWaypoints])
  const startPoint = waypoints.find((point) => point.kind === 'start')
  const endPoint = waypoints.find((point) => point.kind === 'end')
  function selectPlace(kind: 'start' | 'end', place: { label: string; coordinate: [number, number] }) {
    setRoute(null); setNotice(null)
    const next = waypoints.filter((point) => point.kind !== kind)
    dispatchWaypoints({ type: 'commit', waypoints: [...next, { id: crypto.randomUUID(), coordinate: place.coordinate, label: place.label, kind }] })
  }
  function clearPlace(kind: 'start' | 'end') { setRoute(null); dispatchWaypoints({ type: 'commit', waypoints: waypoints.filter((point) => point.kind !== kind) }) }
  function removeWaypoint(id: string) { const next = waypoints.filter((point) => point.id !== id); dispatchWaypoints({ type: 'commit', waypoints: next }); if (route) void requestRoute(next, true); else setRoute(null) }
  function undoWaypoints() { const next = waypointHistory.past.at(-1); if (!next) return; dispatchWaypoints({ type: 'undo' }); if (route) void requestRoute(next, true); else setRoute(null) }
  function redoWaypoints() { const next = waypointHistory.future[0]; if (!next) return; dispatchWaypoints({ type: 'redo' }); if (route) void requestRoute(next, true); else setRoute(null) }

  const visibleSavedRoutes = savedRoutes
    .filter((saved) => saved.name.toLocaleLowerCase(locale).includes(savedSearch.trim().toLocaleLowerCase(locale)))
    .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || (savedSort === 'name' ? a.name.localeCompare(b.name, locale) : savedSort === 'distance' ? b.metrics.distanceKm - a.metrics.distanceKm : new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()))

  const persistedRoute = route ? savedRoutes.find((saved) => saved.id === route.id) : undefined
  const hasUnsavedChanges = Boolean(route && (!persistedRoute || routeSignature(route) !== routeSignature(persistedRoute)))

  function toggleTheme() { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); localStorage.setItem(THEME_KEY, next) }
  function openSavedRoute(saved: PlannedRoute) {
    const editable = ensureEditableAnchors(saved)
    setRoute(editable); dispatchWaypoints({ type: 'reset', waypoints: editable.waypoints }); setMode(editable.mode); setProfile(editable.profile); setShowSaved(false); setMobilePanel(false)
  }

  return <main className={`app-shell theme-${theme}`}>
    <MapCanvas activeRoute={route} savedRoutes={savedRoutes} waypoints={waypoints} onMapClick={handleMapClick} onWaypointMove={handleWaypointMove} onRouteShape={handleRouteShape} activeProfileIndex={activeProfileIndex} locale={locale} />

    <header className="topbar">
      <button className="brand" onClick={reset} aria-label={locale === 'de' ? 'Velvetia Startseite' : 'Velvetia home'}>
        <Image className="brand-full" src={theme === 'light' ? logoLight : logoDark} alt="Velvetia" priority />
        <Image className="brand-mark" src={theme === 'light' ? markLight : markDark} alt="" priority />
      </button>
      <span className="brand-slogan">Plan less. Ride more.</span>
      <nav aria-label={locale === 'de' ? 'Hauptnavigation' : 'Main navigation'}>
        <button className="nav-button is-active"><RouteIcon size={18} /> {copy.planner}</button>
        <button className="nav-button" onClick={() => setShowSaved(true)}><Bookmark size={18} /> {copy.saved}<span className="count">{savedRoutes.length}</span></button>
      </nav>
      <div className="topbar-actions">
        <button className="icon-button mobile-saved-button" onClick={() => setShowSaved(true)} aria-label={copy.saved}><Bookmark size={18} /><span className="count">{savedRoutes.length}</span></button>
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
          {waypointSummary.length ? waypointSummary.map((text, index) => <div className="location-row" key={visibleWaypoints[index].id}><span className={`location-dot ${visibleWaypoints[index].kind}`} /> <span>{text}</span><button onClick={() => removeWaypoint(visibleWaypoints[index].id)} aria-label={`${visibleWaypoints[index].label} ${locale === 'de' ? 'entfernen' : 'remove'}`}><X size={14} /></button></div>) : <button className="map-prompt"><MapPin size={18} /> {copy.mapHint}</button>}
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
      <div className="route-summary-head"><div><p className="eyebrow">{copy.routeReady}</p><input className="route-name-input" value={route.name} maxLength={80} aria-label={locale === 'de' ? 'Routenname' : 'Route name'} onChange={(event) => setRoute({ ...route, name: event.target.value })} /><textarea className="route-description-input" value={route.description ?? ''} maxLength={300} rows={1} placeholder={locale === 'de' ? 'Beschreibung hinzufügen …' : 'Add a description …'} aria-label={locale === 'de' ? 'Routenbeschreibung' : 'Route description'} onChange={(event) => setRoute({ ...route, description: event.target.value })} /></div><div className="route-statuses"><span className={`save-status ${hasUnsavedChanges ? 'is-dirty' : ''}`}>{hasUnsavedChanges ? (locale === 'de' ? 'Ungespeichert' : 'Unsaved') : (locale === 'de' ? 'Gespeichert' : 'Saved')}</span><span className={`preview-badge ${route.metrics.confidence === 'verified' ? 'is-verified' : ''}`}>{route.metrics.confidence === 'verified' ? (locale === 'de' ? 'OSM-Routing' : 'OSM routing') : copy.preview}</span><button className={`route-detail-toggle ${showRouteDetails ? 'is-open' : ''}`} onClick={() => setShowRouteDetails(!showRouteDetails)} aria-expanded={showRouteDetails} aria-label={showRouteDetails ? (locale === 'de' ? 'Routendetails ausblenden' : 'Hide route details') : (locale === 'de' ? 'Routendetails einblenden' : 'Show route details')}><ChevronDown size={16} /><span>{showRouteDetails ? (locale === 'de' ? 'Details ausblenden' : 'Hide details') : (locale === 'de' ? 'Details anzeigen' : 'Show details')}</span></button></div></div>
      {showRouteDetails && <div className="route-details"><div className="metric-grid">
        <div><RouteIcon /><span>{copy.distanceLabel}</span><strong>{route.metrics.distanceKm} km</strong></div>
        <div><Clock3 /><span>{copy.time}</span><strong>{formatDuration(route.metrics.durationMinutes)}</strong></div>
        <div><Mountain /><span>{copy.elevation}</span><strong>{route.metrics.elevationGainM} m</strong></div>
        <div><Bike /><span>{copy.surface}</span><strong>{route.metrics.asphaltPercent} %</strong></div>
      </div>
      <div className="route-detail-grid">
        <ElevationProfile metrics={route.metrics} locale={locale} activeIndex={activeProfileIndex} onActiveIndexChange={setActiveProfileIndex} />
        <div className="surface-card"><div><span>{locale === 'de' ? 'Untergrund' : 'Surface'}</span><strong>{route.metrics.asphaltPercent}% {locale === 'de' ? 'Asphalt' : 'paved'}</strong></div><div className="surface-track"><i style={{ width: `${route.metrics.asphaltPercent}%` }} /></div><small>{route.metrics.cyclewayPercent}% {locale === 'de' ? 'geschätzter Radweganteil' : 'estimated cycleway share'}</small></div>
      </div>
      {route.warnings.length > 0 && <ul className="warning-list">{route.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <RouteProvenance provenance={route.provenance} locale={locale} />
      <p className="preview-note">{route.metrics.confidence === 'verified' ? (locale === 'de' ? 'Straßengenau berechnet mit dem lokalen Schweizer Valhalla-Routinggraphen.' : 'Road-accurate route calculated with the local Swiss Valhalla routing graph.') : copy.previewInfo}</p>
      </div>}
      <div className="route-actions"><button className="secondary-button" onClick={() => saveRoute(false)}><Save size={17} />{persistedRoute ? (locale === 'de' ? 'Änderungen speichern' : 'Save changes') : copy.save}</button>{persistedRoute && <button className="text-button" onClick={() => saveRoute(true)}><Copy size={16} />{locale === 'de' ? 'Als Kopie' : 'Save copy'}</button>}<button className="primary-button" onClick={() => downloadGpx(route)}><Download size={17} />{copy.export}</button><button className="icon-button" onClick={reset} aria-label={copy.clear}><RotateCcw size={18} /></button></div>
    </section>}

    {showSaved && <div className="drawer-backdrop" onClick={() => setShowSaved(false)}><aside className="saved-drawer" onClick={(event) => event.stopPropagation()}>
      <div className="drawer-head"><div><p className="eyebrow">Velvetia</p><h2>{copy.saved}</h2></div><button className="icon-button" onClick={() => setShowSaved(false)} aria-label={locale === 'de' ? 'Schliessen' : 'Close'}><X /></button></div>
      {savedRoutes.length > 0 && <div className="saved-tools"><label className="saved-search"><Search size={16} /><span className="sr-only">{locale === 'de' ? 'Routen suchen' : 'Search routes'}</span><input value={savedSearch} onChange={(event) => setSavedSearch(event.target.value)} placeholder={locale === 'de' ? 'Routen suchen' : 'Search routes'} /></label><select value={savedSort} onChange={(event) => setSavedSort(event.target.value as typeof savedSort)} aria-label={locale === 'de' ? 'Routen sortieren' : 'Sort routes'}><option value="updated">{locale === 'de' ? 'Zuletzt geändert' : 'Last edited'}</option><option value="name">{locale === 'de' ? 'Name' : 'Name'}</option><option value="distance">{locale === 'de' ? 'Distanz' : 'Distance'}</option></select></div>}
      {savedRoutes.length === 0 ? <div className="empty-state"><Bookmark size={28} /><h3>{locale === 'de' ? 'Noch keine Routen' : 'No routes yet'}</h3><p>{locale === 'de' ? 'Gespeicherte Routen erscheinen hier und als dezente Ebene auf der Karte.' : 'Saved routes appear here and as a subtle layer on the map.'}</p></div> : visibleSavedRoutes.length === 0 ? <div className="empty-state"><Search size={28} /><h3>{locale === 'de' ? 'Nichts gefunden' : 'Nothing found'}</h3></div> : <div className="saved-list">{visibleSavedRoutes.map((saved) => <article key={saved.id}>
          <button className="saved-main" onClick={() => openSavedRoute(saved)}><span className="saved-route-icon"><RouteIcon /></span><span><strong>{saved.name}</strong><small>{saved.metrics.distanceKm} km · {formatDuration(saved.metrics.durationMinutes)}</small></span><ChevronDown className="saved-chevron" /></button>
        <div className="saved-actions">
          <button className={saved.favorite ? 'is-favorite' : ''} onClick={() => persistSaved(savedRoutes.map((item) => item.id === saved.id ? { ...item, favorite: !item.favorite } : item))} aria-label={locale === 'de' ? 'Favorit umschalten' : 'Toggle favorite'}><Star size={15} fill={saved.favorite ? 'currentColor' : 'none'} /></button>
          <button onClick={() => persistSaved([{ ...saved, id: crypto.randomUUID(), name: `${saved.name} ${locale === 'de' ? 'Kopie' : 'copy'}`, createdAt: new Date().toISOString(), favorite: false }, ...savedRoutes].slice(0, 50))} aria-label={locale === 'de' ? 'Route duplizieren' : 'Duplicate route'}><Copy size={15} /></button>
          <button className={pendingDelete === saved.id ? 'is-delete-confirm' : ''} onClick={() => { if (pendingDelete === saved.id) { persistSaved(savedRoutes.filter((item) => item.id !== saved.id)); setPendingDelete(null) } else setPendingDelete(saved.id) }} aria-label={pendingDelete === saved.id ? (locale === 'de' ? 'Löschen bestätigen' : 'Confirm delete') : (locale === 'de' ? 'Route löschen' : 'Delete route')}><Trash2 size={15} /></button>
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
