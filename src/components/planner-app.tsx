'use client'

import Image from 'next/image'
import { Bike, Bookmark, Check, ChevronDown, CircleHelp, Clock3, Copy, Download, FileUp, History, Home, Languages, MapPin, Maximize2, Menu, Minimize2, Moon, Mountain, MousePointer2, Navigation, Redo2, RotateCcw, Route as RouteIcon, Save, Search, Sparkles, Star, Sun, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import logoLight from '../../velvetia-full-light.png'
import logoDark from '../../velvetia-full-dark.png'
import markLight from '../../velvetia-light.png'
import markDark from '../../velvetia-dark.png'
import type { BikeProfile, HomePoint, Locale, PlannedRoute, RouteMode, RoutePreferences, RouteVersion, Waypoint } from '@/lib/domain'
import { AUTH_STATE_EVENT, authenticatedFetch } from '@/lib/auth-client'
import { downloadGpx } from '@/lib/gpx'
import { GpxImportError, MAX_GPX_FILE_BYTES, parseGpx } from '@/lib/gpx-import'
import { t } from '@/lib/i18n'
import { MapCanvas } from './map-canvas'
import { Onboarding } from './onboarding'
import { ElevationProfile } from './elevation-profile'
import { PlaceSearch } from './place-search'
import { initialWaypointHistory, waypointHistoryReducer } from '@/lib/waypoint-history'
import { RouteProvenance } from './route-provenance'
import { AccountMenu } from './account-menu'

const LEGACY_STORAGE_KEY = 'velvetia.saved-routes.v1'
const STORAGE_KEY_PREFIX = 'velvetia.saved-routes.v2'
const GUIDE_KEY = 'velvetia.guide-seen.v1'
const THEME_KEY = 'velvetia.theme.v1'

const profiles: Array<{ id: BikeProfile; icon: typeof Bike }> = [
  { id: 'road', icon: Bike }, { id: 'gravel', icon: RouteIcon }, { id: 'touring', icon: Navigation }, { id: 'city', icon: MapPin },
]

function formatDuration(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h} h ${String(m).padStart(2, '0')} min` }
function readStoredRoutes(key: string): PlannedRoute[] { try { return JSON.parse(localStorage.getItem(key) ?? '[]') as PlannedRoute[] } catch { return [] } }
function writeStoredRoutes(key: string, routes: PlannedRoute[]) { try { localStorage.setItem(key, JSON.stringify(routes)) } catch { /* localStorage may be unavailable or full */ } }
function routeSignature(route: PlannedRoute) { return JSON.stringify({ name: route.name.trim(), description: route.description ?? '', profile: route.profile, mode: route.mode, geometry: route.geometry, waypoints: route.waypoints.filter((point) => point.kind !== 'generated'), metrics: route.metrics }) }
function mergeSavedRoutes(local: PlannedRoute[], remote: PlannedRoute[]) {
  const routes = new Map<string, PlannedRoute>()
  for (const route of [...local, ...remote]) {
    const current = routes.get(route.id)
    if (!current || new Date(route.updatedAt ?? route.createdAt).getTime() >= new Date(current.updatedAt ?? current.createdAt).getTime()) routes.set(route.id, route)
  }
  return [...routes.values()].sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()).slice(0, 100)
}

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
  const [routeDetailsExpanded, setRouteDetailsExpanded] = useState(false)
  const gpxInputRef = useRef<HTMLInputElement>(null)
  const [persistenceState, setPersistenceState] = useState<'checking' | 'server' | 'local'>('checking')
  const [historyRouteId, setHistoryRouteId] = useState<string | null>(null)
  const [routeVersions, setRouteVersions] = useState<RouteVersion[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [homePoint, setHomePoint] = useState<HomePoint | null>(null)
  const [homePending, setHomePending] = useState(false)
  const [accountAuthenticated, setAccountAuthenticated] = useState(false)
  const storageKeyRef = useRef(LEGACY_STORAGE_KEY)
  const cloudLoadRef = useRef(0)

  useEffect(() => {
    const loadCloudState = async (includeLegacy: boolean) => {
      const loadId = ++cloudLoadRef.current
      let local = includeLegacy ? readStoredRoutes(LEGACY_STORAGE_KEY) : []
      try {
        const [response, homeResponse] = await Promise.all([
          authenticatedFetch('/api/saved-routes'),
          authenticatedFetch('/api/account/home'),
        ])
        if (!response.ok) throw new Error('LOCAL_ONLY')
        const payload = await response.json() as { routes: PlannedRoute[]; storageScope: string; authenticated: boolean }
        const remote = payload.routes
        const scopedKey = `${STORAGE_KEY_PREFIX}.${payload.storageScope}`
        const scopedLocal = readStoredRoutes(scopedKey)
        local = mergeSavedRoutes(scopedLocal, local)
        storageKeyRef.current = scopedKey
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        const remoteById = new Map(remote.map((item) => [item.id, item]))
        const pending = local.filter((item) => {
          const serverRoute = remoteById.get(item.id)
          return /^[0-9a-f-]{36}$/i.test(item.id) && (!serverRoute || new Date(item.updatedAt ?? item.createdAt).getTime() > new Date(serverRoute.updatedAt ?? serverRoute.createdAt).getTime())
        })
        const migrated = await Promise.all(pending.map(async (item) => {
          const saved = await authenticatedFetch(`/api/saved-routes/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
          return saved.ok ? (await saved.json() as { route: PlannedRoute }).route : item
        }))
        if (loadId !== cloudLoadRef.current) return
        const merged = mergeSavedRoutes(remote, migrated)
        setSavedRoutes(merged); writeStoredRoutes(scopedKey, merged); setPersistenceState('server'); setAccountAuthenticated(payload.authenticated)
        if (payload.authenticated && homeResponse.ok) setHomePoint(((await homeResponse.json()) as { home: HomePoint | null }).home)
        else setHomePoint(null)
      } catch {
        if (loadId !== cloudLoadRef.current) return
        if (includeLegacy) setSavedRoutes(local)
        setPersistenceState('local'); setAccountAuthenticated(false); setHomePoint(null)
      }
    }

    const hydration = window.setTimeout(() => {
      const local = readStoredRoutes(LEGACY_STORAGE_KEY)
      setSavedRoutes(local); setShowGuide(!localStorage.getItem(GUIDE_KEY)); setTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light')
      void loadCloudState(true)
    }, 0)
    const handleAuthChange = () => { void loadCloudState(false) }
    window.addEventListener(AUTH_STATE_EVENT, handleAuthChange)
    return () => { window.clearTimeout(hydration); window.removeEventListener(AUTH_STATE_EVENT, handleAuthChange) }
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

  function persistSaved(next: PlannedRoute[]) { setSavedRoutes(next); writeStoredRoutes(storageKeyRef.current, next) }

  async function syncSavedRoute(saved: PlannedRoute) {
    try {
      const response = await authenticatedFetch(`/api/saved-routes/${saved.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saved) })
      if (!response.ok) throw new Error('LOCAL_ONLY')
      setPersistenceState('server')
      const payload = await response.json() as { route: PlannedRoute; authenticated: boolean; storageScope: string }
      setAccountAuthenticated(payload.authenticated)
      storageKeyRef.current = `${STORAGE_KEY_PREFIX}.${payload.storageScope}`
      return payload.route
    } catch { setPersistenceState('local'); return null }
  }

  async function saveRoute(asCopy = false) {
    if (!route) return
    const name = route.name.trim()
    if (!name) { setNotice(locale === 'de' ? 'Bitte gib der Route einen Namen.' : 'Please give the route a name.'); return }
    const timestamp = new Date().toISOString()
    const saved: PlannedRoute = asCopy
      ? { ...route, id: crypto.randomUUID(), name: `${name} ${locale === 'de' ? 'Kopie' : 'copy'}`, createdAt: timestamp, updatedAt: timestamp, favorite: false, serverVersion: undefined }
      : { ...route, name, updatedAt: timestamp }
    const next = [saved, ...savedRoutes.filter((item) => item.id !== saved.id)].slice(0, 50)
    persistSaved(next); setRoute(saved)
    const serverSaved = await syncSavedRoute(saved)
    if (serverSaved) {
      const synced = [serverSaved, ...next.filter((item) => item.id !== serverSaved.id)]
      persistSaved(synced); setRoute(serverSaved)
    }
    setNotice(asCopy ? (locale === 'de' ? 'Als neue Route gespeichert.' : 'Saved as a new route.') : serverSaved ? (locale === 'de' ? `Route gespeichert · Version ${serverSaved.serverVersion}` : `Route saved · version ${serverSaved.serverVersion}`) : (locale === 'de' ? 'Route lokal gespeichert.' : 'Route saved locally.'))
  }

  async function toggleFavorite(saved: PlannedRoute) {
    const updated = { ...saved, favorite: !saved.favorite, updatedAt: new Date().toISOString() }
    persistSaved(savedRoutes.map((item) => item.id === saved.id ? updated : item)); await syncSavedRoute(updated)
  }

  async function duplicateRoute(saved: PlannedRoute) {
    const timestamp = new Date().toISOString(); const duplicate = { ...saved, id: crypto.randomUUID(), name: `${saved.name} ${locale === 'de' ? 'Kopie' : 'copy'}`, createdAt: timestamp, updatedAt: timestamp, favorite: false, serverVersion: undefined }
    persistSaved([duplicate, ...savedRoutes].slice(0, 100)); await syncSavedRoute(duplicate)
  }

  async function deleteRoute(id: string) {
    persistSaved(savedRoutes.filter((item) => item.id !== id)); setPendingDelete(null); setHistoryRouteId(null)
    try { const response = await authenticatedFetch(`/api/saved-routes/${id}`, { method: 'DELETE' }); if (!response.ok) setPersistenceState('local') } catch { setPersistenceState('local') }
  }

  async function showVersions(id: string) {
    if (historyRouteId === id) { setHistoryRouteId(null); return }
    setHistoryRouteId(id); setHistoryLoading(true); setRouteVersions([])
    try {
      const response = await authenticatedFetch(`/api/saved-routes/${id}/versions`)
      if (!response.ok) throw new Error('NO_HISTORY')
      setRouteVersions((await response.json() as { versions: RouteVersion[] }).versions)
    } catch { setNotice(locale === 'de' ? 'Versionsverlauf ist nur mit verbundener Datenbank verfügbar.' : 'Version history requires a connected database.') }
    finally { setHistoryLoading(false) }
  }

  async function restoreVersion(version: RouteVersion) {
    const restored = { ...version.route, updatedAt: new Date().toISOString() }
    const next = [restored, ...savedRoutes.filter((item) => item.id !== restored.id)]
    persistSaved(next); setRoute(restored); dispatchWaypoints({ type: 'reset', waypoints: restored.waypoints }); setMode(restored.mode); setProfile(restored.profile); setShowSaved(false); setMobilePanel(false)
    const serverSaved = await syncSavedRoute(restored)
    if (serverSaved) { persistSaved([serverSaved, ...next.filter((item) => item.id !== serverSaved.id)]); setRoute(serverSaved) }
    setNotice(locale === 'de' ? `Version ${version.version} als neue Version wiederhergestellt.` : `Version ${version.version} restored as a new version.`)
  }

  function reset() { setRoute(null); dispatchWaypoints({ type: 'reset' }); setNotice(null); setMobilePanel(true); setRouteDetailsExpanded(false) }
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
  async function saveCurrentStartAsHome() {
    if (!startPoint || !accountAuthenticated) return
    setHomePending(true); setNotice(null)
    try {
      const nextHome = { label: startPoint.label, coordinate: startPoint.coordinate }
      const response = await authenticatedFetch('/api/account/home', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nextHome) })
      if (!response.ok) throw new Error('HOME_SAVE_FAILED')
      setHomePoint(((await response.json()) as { home: HomePoint }).home)
      setNotice(locale === 'de' ? 'Zuhause wurde für dein Konto gespeichert.' : 'Home was saved to your account.')
    } catch {
      setNotice(locale === 'de' ? 'Zuhause konnte nicht gespeichert werden.' : 'Home could not be saved.')
    } finally {
      setHomePending(false)
    }
  }
  function useHomeAsStart() {
    if (!homePoint) return
    selectPlace('start', homePoint)
    setNotice(locale === 'de' ? 'Zuhause als Startpunkt gesetzt.' : 'Home set as your start point.')
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
  const isGpxImport = route?.provenance.routingEngine === 'GPX Import'
  const hasSurfaceAnalysis = !isGpxImport && route?.provenance.routingEngine !== 'FOSSGIS OSRM Bike'

  function toggleTheme() { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); localStorage.setItem(THEME_KEY, next) }
  async function importGpx(file: File) {
    const de = locale === 'de'
    try {
      if (file.size > MAX_GPX_FILE_BYTES) throw new Error('file-too-large')
      const imported = parseGpx(await file.text(), file.name, locale, profile)
      routeRequestRef.current?.abort()
      setRoute(imported); dispatchWaypoints({ type: 'reset', waypoints: imported.waypoints }); setMode(imported.mode)
      setDistance(Math.max(5, Math.min(250, Math.round(imported.metrics.distanceKm / 5) * 5)))
      setShowRouteDetails(true); setActiveProfileIndex(null); setMobilePanel(false)
      setNotice(de ? `„${imported.name}“ wurde unverändert importiert.` : `“${imported.name}” was imported without changing its geometry.`)
    } catch (error) {
      const code = error instanceof GpxImportError ? error.code : error instanceof Error ? error.message : 'invalid-xml'
      const messages: Record<string, [string, string]> = {
        'file-too-large': ['Die GPX-Datei ist grösser als 5 MB.', 'The GPX file is larger than 5 MB.'],
        'unsafe-xml': ['Die Datei enthält aus Sicherheitsgründen nicht erlaubte XML-Deklarationen.', 'The file contains XML declarations that are not permitted for security reasons.'],
        'too-many-points': ['Die Datei enthält mehr als 20’000 Punkte.', 'The file contains more than 20,000 points.'],
        'too-many-segments': ['Die Datei enthält mehr als 50 Track-Segmente.', 'The file contains more than 50 track segments.'],
        'not-enough-points': ['Die Datei enthält keine verwendbare Route.', 'The file does not contain a usable route.'],
        'invalid-xml': ['Die GPX-Datei ist ungültig oder beschädigt.', 'The GPX file is invalid or damaged.'],
      }
      setNotice((messages[code] ?? messages['invalid-xml'])[de ? 0 : 1])
    } finally {
      if (gpxInputRef.current) gpxInputRef.current.value = ''
    }
  }
  function openSavedRoute(saved: PlannedRoute) {
    const editable = ensureEditableAnchors(saved)
    setRoute(editable); dispatchWaypoints({ type: 'reset', waypoints: editable.waypoints }); setMode(editable.mode); setProfile(editable.profile); setShowSaved(false); setMobilePanel(false)
  }

  return <main className={`app-shell theme-${theme} ${route && routeDetailsExpanded ? 'has-expanded-route' : ''}`}>
    <MapCanvas activeRoute={route} savedRoutes={savedRoutes} waypoints={waypoints} onMapClick={handleMapClick} onWaypointMove={handleWaypointMove} onRouteShape={handleRouteShape} activeProfileIndex={activeProfileIndex} onActiveProfileIndexChange={setActiveProfileIndex} locale={locale} detailExpanded={Boolean(route && routeDetailsExpanded)} />

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
        <AccountMenu locale={locale} />
        <button className="icon-button mobile-saved-button" onClick={() => setShowSaved(true)} aria-label={copy.saved}><Bookmark size={18} /><span className="count">{savedRoutes.length}</span></button>
        <button className="icon-button labelled" onClick={() => setShowGuide(true)}><CircleHelp size={19} /><span>{copy.guide}</span></button>
        <button className="icon-button" onClick={toggleTheme} aria-label={theme === 'light' ? (locale === 'de' ? 'Dunkles Design' : 'Dark theme') : (locale === 'de' ? 'Helles Design' : 'Light theme')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
        <button className="icon-button" onClick={() => setLocale(locale === 'de' ? 'en' : 'de')} aria-label={locale === 'de' ? 'Sprache wechseln' : 'Switch language'}><Languages size={19} /><b>{locale.toUpperCase()}</b></button>
      </div>
    </header>

    <button className={`mobile-panel-toggle ${mobilePanel ? 'is-panel-open' : ''}`} onClick={() => setMobilePanel(!mobilePanel)} aria-label={mobilePanel ? (locale === 'de' ? 'Planungsmenü schliessen' : 'Close planning menu') : (locale === 'de' ? 'Planungsmenü öffnen' : 'Open planning menu')}>{mobilePanel ? <X /> : <Menu />}</button>

    {route ? <div className="route-edit-hint" role="note"><MousePointer2 size={17} /><span>{locale === 'de' ? 'Route bearbeiten: Linie ziehen oder antippen' : 'Edit route: drag or tap the line'}</span></div> : null}

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
        {accountAuthenticated && <div className="home-point-actions">
          {homePoint ? <button type="button" className="home-point-use" onClick={useHomeAsStart}><Home size={16} /><span><b>{locale === 'de' ? 'Zuhause' : 'Home'}</b><small>{homePoint.label}</small></span></button> : <span className="home-point-empty"><Home size={15} />{locale === 'de' ? 'Noch kein Zuhause gespeichert' : 'No home saved yet'}</span>}
          {startPoint && <button type="button" className="home-point-save" onClick={() => void saveCurrentStartAsHome()} disabled={homePending}><Star size={14} />{homePending ? (locale === 'de' ? 'Speichert …' : 'Saving …') : homePoint ? (locale === 'de' ? 'Zuhause aktualisieren' : 'Update home') : (locale === 'de' ? 'Als Zuhause speichern' : 'Save as home')}</button>}
        </div>}
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

      {mode === 'round-trip' && <section className="form-section distance-section">
        <div className="section-heading"><span>03</span><h2>{copy.distance}</h2><strong>{distance} km</strong></div>
        <input type="range" min="5" max="250" step="5" value={distance} onChange={(event) => setDistance(Number(event.target.value))} aria-label={`${copy.distance}: ${distance} km`} />
        <div className="range-labels"><span>5 km</span><span>250 km</span></div>
      </section>}

      {notice && <div className="notice" role="status">{notice}</div>}
      <button className="primary-button plan-button" onClick={planRoute} disabled={isPlanning}>{isPlanning ? <><span className="spinner" />{copy.planning}</> : <><Sparkles size={19} />{copy.calculate}</>}</button>
      <label className="secondary-button import-button"><FileUp size={18} />{locale === 'de' ? 'GPX importieren' : 'Import GPX'}<input ref={gpxInputRef} className="sr-only" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" aria-label={locale === 'de' ? 'GPX-Datei auswählen' : 'Choose GPX file'} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importGpx(file) }} /></label>
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

    {route && <section className={`route-summary ${routeDetailsExpanded ? 'is-expanded' : ''}`} aria-label={locale === 'de' ? 'Routenzusammenfassung' : 'Route summary'}>
      <div className="route-summary-head"><div><p className="eyebrow">{copy.routeReady}</p><input className="route-name-input" value={route.name} maxLength={80} aria-label={locale === 'de' ? 'Routenname' : 'Route name'} onChange={(event) => setRoute({ ...route, name: event.target.value })} /><textarea className="route-description-input" value={route.description ?? ''} maxLength={300} rows={1} placeholder={locale === 'de' ? 'Beschreibung hinzufügen …' : 'Add a description …'} aria-label={locale === 'de' ? 'Routenbeschreibung' : 'Route description'} onChange={(event) => setRoute({ ...route, description: event.target.value })} /></div><div className="route-statuses"><span className={`save-status ${hasUnsavedChanges ? 'is-dirty' : ''}`}>{hasUnsavedChanges ? (locale === 'de' ? 'Ungespeichert' : 'Unsaved') : (locale === 'de' ? 'Gespeichert' : 'Saved')}</span><span className={`preview-badge ${route.metrics.confidence === 'verified' ? 'is-verified' : ''}`}>{isGpxImport ? 'GPX Import' : route.metrics.confidence === 'verified' ? (locale === 'de' ? 'OSM-Routing' : 'OSM routing') : copy.preview}</span><button className="route-expand-toggle" onClick={() => { const expanded = !routeDetailsExpanded; setRouteDetailsExpanded(expanded); if (expanded) setShowRouteDetails(true) }} aria-pressed={routeDetailsExpanded} aria-label={routeDetailsExpanded ? (locale === 'de' ? 'Kompakte Detailansicht' : 'Compact detail view') : (locale === 'de' ? 'Grosse Detailansicht neben der Karte' : 'Large detail view beside the map')}>{routeDetailsExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{routeDetailsExpanded ? (locale === 'de' ? 'Kompakt' : 'Compact') : (locale === 'de' ? 'Gross' : 'Expand')}</span></button><button className={`route-detail-toggle ${showRouteDetails ? 'is-open' : ''}`} onClick={() => setShowRouteDetails(!showRouteDetails)} aria-expanded={showRouteDetails} aria-label={showRouteDetails ? (locale === 'de' ? 'Routendetails ausblenden' : 'Hide route details') : (locale === 'de' ? 'Routendetails einblenden' : 'Show route details')}><ChevronDown size={16} /><span>{showRouteDetails ? (locale === 'de' ? 'Details ausblenden' : 'Hide details') : (locale === 'de' ? 'Details anzeigen' : 'Show details')}</span></button></div></div>
      {showRouteDetails && <div className="route-details"><div className="metric-grid">
        <div><RouteIcon /><span>{copy.distanceLabel}</span><strong>{route.metrics.distanceKm} km</strong></div>
        <div><Clock3 /><span>{copy.time}</span><strong>{formatDuration(route.metrics.durationMinutes)}</strong></div>
        <div><Mountain /><span>{copy.elevation}</span><strong>{route.metrics.elevationGainM} m</strong></div>
        <div><Bike /><span>{copy.surface}</span><strong>{hasSurfaceAnalysis ? `${route.metrics.asphaltPercent} %` : '—'}</strong></div>
      </div>
      <div className="route-detail-grid">
        <ElevationProfile route={route} locale={locale} activeIndex={activeProfileIndex} onActiveIndexChange={setActiveProfileIndex} />
        <div className="surface-card">{!hasSurfaceAnalysis ? <div><span>{locale === 'de' ? 'Untergrund' : 'Surface'}</span><strong>{locale === 'de' ? 'Nicht analysiert' : 'Not analysed'}</strong></div> : <><div><span>{locale === 'de' ? 'Untergrund' : 'Surface'}</span><strong>{route.metrics.asphaltPercent}% {locale === 'de' ? 'Asphalt' : 'paved'}</strong></div><div className="surface-track"><i style={{ width: `${route.metrics.asphaltPercent}%` }} /></div><small>{route.metrics.cyclewayPercent}% {locale === 'de' ? 'geschätzter Radweganteil' : 'estimated cycleway share'}</small></>}</div>
      </div>
      {route.warnings.length > 0 && <ul className="warning-list">{route.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <RouteProvenance provenance={route.provenance} locale={locale} />
      <p className="preview-note">{isGpxImport ? (locale === 'de' ? 'Die Geometrie entspricht unverändert der importierten Datei.' : 'The geometry is unchanged from the imported file.') : route.provenance.routingEngine === 'FOSSGIS OSRM Bike' ? (locale === 'de' ? 'Straßengenau über den öffentlichen FOSSGIS-OSM-Fahrradrouter berechnet.' : 'Road-accurate route calculated with the public FOSSGIS OSM bicycle router.') : route.metrics.confidence === 'verified' ? (locale === 'de' ? 'Straßengenau berechnet mit dem lokalen Schweizer Valhalla-Routinggraphen.' : 'Road-accurate route calculated with the local Swiss Valhalla routing graph.') : copy.previewInfo}</p>
      </div>}
      <div className="route-actions"><button className="secondary-button" onClick={() => saveRoute(false)}><Save size={17} />{persistedRoute ? (locale === 'de' ? 'Änderungen speichern' : 'Save changes') : copy.save}</button>{persistedRoute && <button className="text-button" onClick={() => saveRoute(true)}><Copy size={16} />{locale === 'de' ? 'Als Kopie' : 'Save copy'}</button>}<button className="primary-button" onClick={() => downloadGpx(route)}><Download size={17} />{copy.export}</button><button className="icon-button" onClick={reset} aria-label={copy.clear}><RotateCcw size={18} /></button></div>
    </section>}

    {showSaved && <div className="drawer-backdrop" onClick={() => setShowSaved(false)}><aside className="saved-drawer" onClick={(event) => event.stopPropagation()}>
      <div className="drawer-head"><div><p className="eyebrow">Velvetia</p><h2>{copy.saved}</h2><span className={`persistence-status is-${persistenceState}`}>{persistenceState === 'server' ? accountAuthenticated ? (locale === 'de' ? 'Mit deinem Konto synchronisiert' : 'Synced with your account') : (locale === 'de' ? 'Anonymer Cloud-Speicher' : 'Anonymous cloud storage') : persistenceState === 'checking' ? (locale === 'de' ? 'Speicher wird geprüft …' : 'Checking storage …') : (locale === 'de' ? 'Lokaler Speicher' : 'Local storage')}</span></div><button className="icon-button" onClick={() => setShowSaved(false)} aria-label={locale === 'de' ? 'Schliessen' : 'Close'}><X /></button></div>
      {savedRoutes.length > 0 && <div className="saved-tools"><label className="saved-search"><Search size={16} /><span className="sr-only">{locale === 'de' ? 'Routen suchen' : 'Search routes'}</span><input value={savedSearch} onChange={(event) => setSavedSearch(event.target.value)} placeholder={locale === 'de' ? 'Routen suchen' : 'Search routes'} /></label><select value={savedSort} onChange={(event) => setSavedSort(event.target.value as typeof savedSort)} aria-label={locale === 'de' ? 'Routen sortieren' : 'Sort routes'}><option value="updated">{locale === 'de' ? 'Zuletzt geändert' : 'Last edited'}</option><option value="name">{locale === 'de' ? 'Name' : 'Name'}</option><option value="distance">{locale === 'de' ? 'Distanz' : 'Distance'}</option></select></div>}
      {savedRoutes.length === 0 ? <div className="empty-state"><Bookmark size={28} /><h3>{locale === 'de' ? 'Noch keine Routen' : 'No routes yet'}</h3><p>{locale === 'de' ? 'Gespeicherte Routen erscheinen hier und als dezente Ebene auf der Karte.' : 'Saved routes appear here and as a subtle layer on the map.'}</p></div> : visibleSavedRoutes.length === 0 ? <div className="empty-state"><Search size={28} /><h3>{locale === 'de' ? 'Nichts gefunden' : 'Nothing found'}</h3></div> : <div className="saved-list">{visibleSavedRoutes.map((saved) => <article key={saved.id}>
          <button className="saved-main" onClick={() => openSavedRoute(saved)}><span className="saved-route-icon"><RouteIcon /></span><span><strong>{saved.name}</strong><small>{saved.metrics.distanceKm} km · {formatDuration(saved.metrics.durationMinutes)}</small></span><ChevronDown className="saved-chevron" /></button>
        <div className="saved-actions">
          <button className={saved.favorite ? 'is-favorite' : ''} onClick={() => void toggleFavorite(saved)} aria-label={locale === 'de' ? 'Favorit umschalten' : 'Toggle favorite'}><Star size={15} fill={saved.favorite ? 'currentColor' : 'none'} /></button>
          <button onClick={() => void showVersions(saved.id)} aria-expanded={historyRouteId === saved.id} aria-label={locale === 'de' ? 'Versionsverlauf' : 'Version history'}><History size={15} /></button>
          <button onClick={() => void duplicateRoute(saved)} aria-label={locale === 'de' ? 'Route duplizieren' : 'Duplicate route'}><Copy size={15} /></button>
          <button className={pendingDelete === saved.id ? 'is-delete-confirm' : ''} onClick={() => { if (pendingDelete === saved.id) void deleteRoute(saved.id); else setPendingDelete(saved.id) }} aria-label={pendingDelete === saved.id ? (locale === 'de' ? 'Löschen bestätigen' : 'Confirm delete') : (locale === 'de' ? 'Route löschen' : 'Delete route')}><Trash2 size={15} /></button>
        </div>
        {historyRouteId === saved.id ? <div className="version-history">{historyLoading ? <span>{locale === 'de' ? 'Versionen werden geladen …' : 'Loading versions …'}</span> : routeVersions.length ? routeVersions.map((version) => <button key={version.version} onClick={() => void restoreVersion(version)}><span><b>v{version.version}</b>{new Date(version.savedAt).toLocaleString(locale === 'de' ? 'de-CH' : 'en-GB')}</span><RotateCcw size={14} /><span className="sr-only">{locale === 'de' ? 'wiederherstellen' : 'restore'}</span></button>) : <span>{locale === 'de' ? 'Noch keine Serverversionen.' : 'No server versions yet.'}</span>}</div> : null}
      </article>)}</div>}
    </aside></div>}
    {showGuide && <Onboarding onClose={closeGuide} locale={locale} />}

    <footer className="font-credit">Fonts made from <a href="http://www.onlinewebfonts.com" target="_blank" rel="noreferrer">Web Fonts</a> is licensed by CC BY 4.0</footer>
  </main>
}

function PreferenceSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Array<[T, string]> }) {
  return <label className="preference-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>
}
