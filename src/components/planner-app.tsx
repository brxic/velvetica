'use client'

import { Copy } from 'lucide-react'
import { Bike, Bookmark, Check, ChevronDown, CircleHelp, FileUp, History, Home, Languages, MapPin, Maximize2, SlidersHorizontal, Minimize2, Moon, MousePointer2, Navigation, Redo2, RotateCcw, Route as RouteIcon, Search, Sparkles, Star, Sun, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { BrandLogo } from './brand-logo'
import type { BikeProfile, HomePoint, Locale, PlannedRoute, RouteMode, RoutePreferences, RouteVersion, Waypoint } from '@/lib/domain'
import { AUTH_STATE_EVENT, authenticatedFetch } from '@/lib/auth-client'
import { GpxImportError, MAX_GPX_FILE_BYTES, parseGpx } from '@/lib/gpx-import'
import { t } from '@/lib/i18n'
import { MapCanvas } from './map-canvas'
import { Onboarding } from './onboarding'
import { RouteDetails } from './route-details'
import { Button } from './ui/button'
import { useConfirmation } from './ui/confirmation'
import { PlaceSearch } from './place-search'
import { initialWaypointHistory, waypointHistoryReducer } from '@/lib/waypoint-history'
import { AccountMenu } from './account-menu'
import { defaultAccountPreferences, type AccountPreferences } from '@/lib/account-preferences'
import { PREFERENCES_EVENT } from './account-settings'
import { RouteActions } from './route-actions'
import { AppDialog } from './ui/dialog'
import { plannedRouteSchema } from '@/lib/route-schema'
import { RouteThumbnail } from './route-thumbnail'
import { acknowledgeSavedDraft, routeSignature, type RouteSyncState } from '@/lib/route-draft'
import { PWA_UPDATE_CHECK } from '@/lib/pwa'

const LEGACY_STORAGE_KEY = 'velvetia.saved-routes.v1'
const STORAGE_KEY_PREFIX = 'velvetia.saved-routes.v2'
const GUIDE_KEY = 'velvetia.guide-seen.v1'
const THEME_KEY = 'velvetia.theme.v1'

const profiles: Array<{ id: BikeProfile; icon: typeof Bike }> = [
  { id: 'road', icon: Bike }, { id: 'gravel', icon: RouteIcon }, { id: 'touring', icon: Navigation }, { id: 'city', icon: MapPin },
]

function formatDuration(minutes: number) { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h}:${String(m).padStart(2, '0')} h` }
function readStoredRoutes(key: string): PlannedRoute[] { try { const items: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(items) ? items.flatMap((item) => { const parsed = plannedRouteSchema.safeParse(item); return parsed.success ? [parsed.data] : [] }) : [] } catch { return [] } }
function writeStoredRoutes(key: string, routes: PlannedRoute[]) { try { localStorage.setItem(key, JSON.stringify(routes)); return true } catch { return false } }
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
  const localeRef = useRef(locale)
  useEffect(() => { localeRef.current = locale }, [locale])
  const { confirm: askConfirmation, confirmation } = useConfirmation(locale)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mode, setMode] = useState<RouteMode>('round-trip'); const [profile, setProfile] = useState<BikeProfile>('road')
  const [distance, setDistance] = useState(60); const [waypointHistory, dispatchWaypoints] = useReducer(waypointHistoryReducer, initialWaypointHistory)
  const waypoints = waypointHistory.present
  const [preferences, setPreferences] = useState<RoutePreferences>({ surface: 'balanced', climbing: 'balanced', safety: 'quiet' })
  const [route, setRoute] = useState<PlannedRoute | null>(null); const [savedRoutes, setSavedRoutes] = useState<PlannedRoute[]>([])
  const activeRouteRef = useRef<PlannedRoute | null>(null)
  useEffect(() => { activeRouteRef.current = route }, [route])
  const [isPlanning, setIsPlanning] = useState(false); const [notice, setNotice] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false); const [showSaved, setShowSaved] = useState(false); const [plannerOpen, setPlannerOpen] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [compactViewport, setCompactViewport] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)')
    const update = () => setCompactViewport(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const [savedSearch, setSavedSearch] = useState('')
  const [savedProfile, setSavedProfile] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [maxSavedDistance, setMaxSavedDistance] = useState(500)
  const [saving, setSaving] = useState(false)
  const [syncConflict, setSyncConflict] = useState(false)
  const [routeSyncStates, setRouteSyncStates] = useState<Record<string, RouteSyncState>>({})
  const saveInFlightRef = useRef(false)
  const identityEpochRef = useRef(0)
  const accountDefaultsRef = useRef<AccountPreferences>(defaultAccountPreferences)
  const [speedKmh, setSpeedKmh] = useState<number | null>(null)
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
  const historyLoadRef = useRef(0)
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
        const [response, homeResponse, preferencesResponse] = await Promise.all([
          authenticatedFetch('/api/saved-routes'),
          authenticatedFetch('/api/account/home'),
          authenticatedFetch('/api/account/preferences'),
        ])
        if (!response.ok) throw new Error('LOCAL_ONLY')
        const payload = await response.json() as { routes: PlannedRoute[]; storageScope: string; authenticated: boolean }
        const remote = payload.routes
        const scopedKey = `${STORAGE_KEY_PREFIX}.${payload.storageScope}`
        const scopedLocal = readStoredRoutes(scopedKey)
        if (loadId !== cloudLoadRef.current) return
        local = mergeSavedRoutes(scopedLocal, local)
        storageKeyRef.current = scopedKey
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        const remoteById = new Map(remote.map((item) => [item.id, item]))
        const pending = local.filter((item) => {
          const serverRoute = remoteById.get(item.id)
          return /^[0-9a-f-]{36}$/i.test(item.id) && (!serverRoute || new Date(item.updatedAt ?? item.createdAt).getTime() > new Date(serverRoute.updatedAt ?? serverRoute.createdAt).getTime())
        })
        let failedSync = false
        const migrationStates = new Map<string, RouteSyncState>()
        const migrated = await Promise.all(pending.map(async (item) => {
          const saved = await authenticatedFetch(`/api/saved-routes/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
          migrationStates.set(item.id, saved.ok ? 'synced' : saved.status === 409 ? 'conflict' : 'local')
          if (!saved.ok) failedSync = true
          if (saved.status === 409 && loadId === cloudLoadRef.current) { setSyncConflict(true); setNotice(localeRef.current === 'de' ? 'Diese Route wurde auf einem anderen Gerät geändert. Speichere deine Änderungen als Kopie.' : 'This route changed on another device. Save your changes as a copy.') }
          return saved.ok ? (await saved.json() as { route: PlannedRoute }).route : item
        }))
        if (loadId !== cloudLoadRef.current) return
        const merged = mergeSavedRoutes(mergeSavedRoutes(remote, migrated), readStoredRoutes(scopedKey))
        const acknowledged = new Map([...remote, ...migrated.filter((item) => migrationStates.get(item.id) === 'synced')].map((item) => [item.id, item]))
        setRouteSyncStates(Object.fromEntries(merged.map((item) => [item.id, migrationStates.get(item.id) === 'conflict' ? 'conflict' : acknowledged.has(item.id) && routeSignature(acknowledged.get(item.id)!) === routeSignature(item) ? 'synced' : 'local'])))
        setSavedRoutes(merged); writeStoredRoutes(scopedKey, merged); setPersistenceState(failedSync ? 'local' : 'server'); setAccountAuthenticated(payload.authenticated)
        if (payload.authenticated && homeResponse.ok) setHomePoint(((await homeResponse.json()) as { home: HomePoint | null }).home)
        else setHomePoint(null)
        if (payload.authenticated && preferencesResponse.ok) {
          const defaults = ((await preferencesResponse.json()) as { preferences: AccountPreferences }).preferences
          accountDefaultsRef.current = defaults
          if (!activeRouteRef.current) { setProfile(defaults.profile); setDistance(defaults.distanceKm); setPreferences({ surface: defaults.surface, climbing: defaults.climbing, safety: defaults.safety }) }
          setSpeedKmh(defaults.speedKmh)
        } else { accountDefaultsRef.current = defaultAccountPreferences; setSpeedKmh(null) }
      } catch {
        if (loadId !== cloudLoadRef.current) return
        if (includeLegacy) setSavedRoutes(mergeSavedRoutes(local, readStoredRoutes(storageKeyRef.current)))
        setPersistenceState('local'); setAccountAuthenticated(false); setHomePoint(null)
      }
    }

    const hydration = window.setTimeout(() => {
      const local = readStoredRoutes(LEGACY_STORAGE_KEY)
      setSavedRoutes(local); setShowGuide(!localStorage.getItem(GUIDE_KEY)); setTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light')
      void loadCloudState(true)
    }, 0)
    const handleAuthChange = () => {
      identityEpochRef.current++
      setRouteSyncStates({})
      activeRouteRef.current = null
      historyLoadRef.current++; setHistoryRouteId(null); setRouteVersions([])
      routeRequestRef.current?.abort(); setRoute(null); setSavedRoutes([]); setHomePoint(null); setShowSaved(false); setAccountAuthenticated(false)
      dispatchWaypoints({ type: 'reset' }); storageKeyRef.current = `${STORAGE_KEY_PREFIX}.offline`; setPersistenceState('checking')
      void loadCloudState(false)
    }
    const handlePreferences = () => { void loadCloudState(false) }
    window.addEventListener(AUTH_STATE_EVENT, handleAuthChange)
    window.addEventListener(PREFERENCES_EVENT, handlePreferences)
    window.addEventListener('online', handlePreferences)
    return () => { window.clearTimeout(hydration); window.removeEventListener(AUTH_STATE_EVENT, handleAuthChange); window.removeEventListener(PREFERENCES_EVENT, handlePreferences); window.removeEventListener('online', handlePreferences); routeRequestRef.current?.abort() }
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
      if (routeRequestRef.current !== controller) return
      setRoute((current) => preserveExisting && current ? { ...planned, id: current.id, name: current.name, description: current.description, createdAt: current.createdAt, updatedAt: current.updatedAt, favorite: current.favorite, serverVersion: current.serverVersion } : planned)
      if (!preserveExisting && planned.waypoints.some((point) => point.kind === 'generated')) dispatchWaypoints({ type: 'reset', waypoints: planned.waypoints })
      setActiveProfileIndex(null); setPlannerOpen(false)
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) { setNotice(locale === 'de' ? 'Die Route konnte nicht berechnet werden.' : 'The route could not be planned.'); if (route) setPlannerOpen(false) } }
    finally { if (routeRequestRef.current === controller) { routeRequestRef.current = null; setIsPlanning(false) } }
  }

  async function planRoute() { if (await confirmDiscard()) await requestRoute(waypoints, false) }

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

  function persistSaved(next: PlannedRoute[]) { setSavedRoutes(next); return writeStoredRoutes(storageKeyRef.current, next) }

  function setRouteSync(id: string, state: RouteSyncState) { setRouteSyncStates((current) => ({ ...current, [id]: state })) }

  async function syncSavedRoute(saved: PlannedRoute) {
    const identityEpoch = identityEpochRef.current
    setRouteSync(saved.id, 'syncing')
    try {
      const response = await authenticatedFetch(`/api/saved-routes/${saved.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saved) })
      if (identityEpoch !== identityEpochRef.current) return null
      if (response.status === 409) { setRouteSync(saved.id, 'conflict'); setSyncConflict(true); setNotice(locale === 'de' ? 'Diese Route wurde auf einem anderen Gerät geändert. Speichere deine Änderungen als Kopie oder lade die aktuelle Version neu.' : 'This route changed on another device. Save your changes as a copy or reload the current version.'); return null }
      if (!response.ok) throw new Error('LOCAL_ONLY')
      const payload = await response.json() as { route: PlannedRoute; authenticated: boolean; storageScope: string }
      if (identityEpoch !== identityEpochRef.current) return null
      setPersistenceState('server')
      setAccountAuthenticated(payload.authenticated)
      storageKeyRef.current = `${STORAGE_KEY_PREFIX}.${payload.storageScope}`
      setRouteSync(saved.id, 'synced')
      return payload.route
    } catch { if (identityEpoch === identityEpochRef.current) { setPersistenceState('local'); setRouteSync(saved.id, 'local') } return null }
  }

  async function saveRoute(asCopy = false) {
    if (!route || saveInFlightRef.current) return
    const name = route.name.trim()
    if (!name) { setNotice(locale === 'de' ? 'Bitte gib der Route einen Namen.' : 'Please give the route a name.'); return }
    setSaving(true); setSyncConflict(false); setNotice(null)
    saveInFlightRef.current = true
    const identityEpoch = identityEpochRef.current
    const timestamp = new Date().toISOString()
    const saved: PlannedRoute = asCopy
      ? { ...route, id: crypto.randomUUID(), name: `${name.slice(0, 73)} ${locale === 'de' ? 'Kopie' : 'copy'}`, createdAt: timestamp, updatedAt: timestamp, favorite: false, serverVersion: undefined }
      : { ...route, name, updatedAt: timestamp }
    const next = [saved, ...savedRoutes.filter((item) => item.id !== saved.id)].slice(0, 50)
    const locallySecured = persistSaved(next); setRoute(saved)
    const serverSaved = await syncSavedRoute(saved)
    if (identityEpoch !== identityEpochRef.current) { saveInFlightRef.current = false; setSaving(false); return }
    if (serverSaved) {
      setSavedRoutes((items) => { const synced = [serverSaved, ...items.filter((item) => item.id !== serverSaved.id)]; writeStoredRoutes(storageKeyRef.current, synced); return synced })
      setRoute((current) => acknowledgeSavedDraft(current, saved, serverSaved))
    }
    if (serverSaved) setNotice(asCopy ? (locale === 'de' ? 'Als neue Route gespeichert.' : 'Saved as a new route.') : (locale === 'de' ? `Route gespeichert · Version ${serverSaved.serverVersion}` : `Route saved · version ${serverSaved.serverVersion}`))
    else if (!locallySecured) { setRouteSync(saved.id, 'error'); setNotice(locale === 'de' ? 'Speichern fehlgeschlagen: Weder lokaler Speicher noch Cloud sind verfügbar. Lass diese Route geöffnet und exportiere sie als GPX.' : 'Save failed: neither local storage nor cloud is available. Keep this route open and export it as GPX.') }
    else setNotice((current) => current ?? (!navigator.onLine ? (locale === 'de' ? 'Lokal gespeichert · Cloud-Abgleich ausstehend.' : 'Saved locally · cloud sync pending.') : (locale === 'de' ? 'Nur auf diesem Gerät gespeichert. Cloud-Synchronisierung ausstehend. Erneut speichern, sobald du online bist.' : 'Saved only on this device. Cloud sync pending. Save again when online.')))
    saveInFlightRef.current = false
    setSaving(false)
  }

  async function toggleFavorite(saved: PlannedRoute) {
    const updated = { ...saved, favorite: !saved.favorite, updatedAt: new Date().toISOString() }
    persistSaved(savedRoutes.map((item) => item.id === saved.id ? updated : item))
    const server = await syncSavedRoute(updated)
    if (server) { setSavedRoutes((items) => { const next = items.map((item) => item.id === saved.id ? server : item); writeStoredRoutes(storageKeyRef.current, next); return next }); setRoute((current) => current?.id === server.id ? { ...current, favorite: server.favorite, serverVersion: server.serverVersion } : current) }
  }

  async function duplicateRoute(saved: PlannedRoute) {
    const timestamp = new Date().toISOString(); const duplicate = { ...saved, id: crypto.randomUUID(), name: `${saved.name.slice(0, 73)} ${locale === 'de' ? 'Kopie' : 'copy'}`, createdAt: timestamp, updatedAt: timestamp, favorite: false, serverVersion: undefined }
    persistSaved([duplicate, ...savedRoutes].slice(0, 100))
    const server = await syncSavedRoute(duplicate)
    if (server) { setSavedRoutes((items) => { const next = items.map((item) => item.id === server.id ? server : item); writeStoredRoutes(storageKeyRef.current, next); return next }) }
  }

  async function deleteRoute(id: string) {
    const identityEpoch = cloudLoadRef.current
    try {
      const response = await authenticatedFetch(`/api/saved-routes/${id}`, { method: 'DELETE' })
      if (identityEpoch !== cloudLoadRef.current) return
      if (!response.ok && response.status !== 404) throw new Error('DELETE_FAILED')
      persistSaved(savedRoutes.filter((item) => item.id !== id)); setPendingDelete(null); setHistoryRouteId(null)
      if (route?.id === id) setRoute(null)
    } catch { setNotice(locale === 'de' ? 'Löschen fehlgeschlagen. Die Route bleibt erhalten. Bitte erneut versuchen.' : 'Delete failed. Your route is still here. Please try again.') }
  }

  async function showVersions(id: string) {
    if (historyRouteId === id) { setHistoryRouteId(null); return }
    const loadId = ++historyLoadRef.current
    setHistoryRouteId(id); setHistoryLoading(true); setRouteVersions([])
    try {
      const response = await authenticatedFetch(`/api/saved-routes/${id}/versions`)
      if (!response.ok) throw new Error('NO_HISTORY')
      const versions = (await response.json() as { versions: RouteVersion[] }).versions
      if (loadId === historyLoadRef.current) setRouteVersions(versions)
    } catch { setNotice(locale === 'de' ? 'Versionsverlauf ist nur mit verbundener Datenbank verfügbar.' : 'Version history requires a connected database.') }
    finally { if (loadId === historyLoadRef.current) setHistoryLoading(false) }
  }

  async function restoreVersion(version: RouteVersion) {
    if (saveInFlightRef.current || !(await confirmDiscard())) return
    setSaving(true)
    saveInFlightRef.current = true
    const identityEpoch = identityEpochRef.current
    const latest = savedRoutes.find((item) => item.id === version.route.id)
    const restored = { ...version.route, serverVersion: latest?.serverVersion, updatedAt: new Date().toISOString() }
    const next = [restored, ...savedRoutes.filter((item) => item.id !== restored.id)]
    cancelPlanning()
    const locallySecured = persistSaved(next)
    setRoute(restored); dispatchWaypoints({ type: 'reset', waypoints: restored.waypoints }); setMode(restored.mode); setProfile(restored.profile); setShowSaved(false); setPlannerOpen(false)
    const serverSaved = await syncSavedRoute(restored)
    if (identityEpoch !== identityEpochRef.current) { saveInFlightRef.current = false; setSaving(false); return }
    if (serverSaved) {
      setSavedRoutes((items) => { const synced = [serverSaved, ...items.filter((item) => item.id !== serverSaved.id)]; writeStoredRoutes(storageKeyRef.current, synced); return synced })
      setRoute((current) => acknowledgeSavedDraft(current, restored, serverSaved))
    }
    if (serverSaved) setNotice(locale === 'de' ? `Version ${version.version} als neue Version wiederhergestellt.` : `Version ${version.version} restored as a new version.`)
    else if (!locallySecured) { setRouteSync(restored.id, 'error'); setNotice(locale === 'de' ? 'Wiederherstellung ist nicht gesichert. Bitte als GPX exportieren oder erneut speichern.' : 'Restored draft is not secured. Export GPX or save again.') }
    else setNotice((current) => current ?? (locale === 'de' ? 'Version lokal wiederhergestellt. Cloud-Synchronisierung ausstehend.' : 'Version restored locally. Cloud sync pending.'))
    saveInFlightRef.current = false
    setSaving(false)
  }

  function cancelPlanning() { routeRequestRef.current?.abort(); routeRequestRef.current = null; setIsPlanning(false); setActiveProfileIndex(null) }
  async function reset() { if (!(await confirmDiscard())) return; cancelPlanning(); setRoute(null); dispatchWaypoints({ type: 'reset' }); setNotice(null); setSyncConflict(false); setPlannerOpen(true); setRouteDetailsExpanded(false); const defaults = accountDefaultsRef.current; setProfile(defaults.profile); setDistance(defaults.distanceKm); setPreferences({ surface: defaults.surface, climbing: defaults.climbing, safety: defaults.safety }) }
  async function changeMode(nextMode: RouteMode) { if (nextMode === mode || !(await confirmDiscard())) return; cancelPlanning(); setMode(nextMode); setRoute(null); dispatchWaypoints({ type: 'commit', waypoints: waypoints.filter((point) => point.kind === 'start') }) }
  function closeGuide() { setShowGuide(false); localStorage.setItem(GUIDE_KEY, 'true') }

  const visibleWaypoints = useMemo(() => waypoints.filter((point) => point.kind !== 'generated'), [waypoints])
  const waypointSummary = useMemo(() => visibleWaypoints.map((point) => `${point.label}: ${point.coordinate[1].toFixed(4)}, ${point.coordinate[0].toFixed(4)}`), [visibleWaypoints])
  const startPoint = waypoints.find((point) => point.kind === 'start')
  const endPoint = waypoints.find((point) => point.kind === 'end')
  async function selectPlace(kind: 'start' | 'end', place: { label: string; coordinate: [number, number] }) {
    if (!(await confirmDiscard())) return false
    cancelPlanning()
    setRoute(null); setNotice(null)
    const next = waypoints.filter((point) => point.kind !== kind)
    dispatchWaypoints({ type: 'commit', waypoints: [...next, { id: crypto.randomUUID(), coordinate: place.coordinate, label: place.label, kind }] })
    return true
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
  async function useHomeAsStart() {
    if (!homePoint) return
    if (!(await selectPlace('start', homePoint))) return
    setNotice(locale === 'de' ? 'Zuhause als Startpunkt gesetzt.' : 'Home set as your start point.')
  }
  async function clearPlace(kind: 'start' | 'end') { if (!(await confirmDiscard())) return false; cancelPlanning(); setRoute(null); dispatchWaypoints({ type: 'commit', waypoints: waypoints.filter((point) => point.kind !== kind) }); return true }
  function removeWaypoint(id: string) { const next = waypoints.filter((point) => point.id !== id); dispatchWaypoints({ type: 'commit', waypoints: next }); if (route) void requestRoute(next, true); else setRoute(null) }
  function undoWaypoints() { const next = waypointHistory.past.at(-1); if (!next) return; dispatchWaypoints({ type: 'undo' }); if (route) void requestRoute(next, true); else setRoute(null) }
  function redoWaypoints() { const next = waypointHistory.future[0]; if (!next) return; dispatchWaypoints({ type: 'redo' }); if (route) void requestRoute(next, true); else setRoute(null) }

  const visibleSavedRoutes = savedRoutes
    .filter((saved) => saved.name.toLocaleLowerCase(locale).includes(savedSearch.trim().toLocaleLowerCase(locale)))
    .filter((saved) => (savedProfile === 'all' || saved.profile === savedProfile) && (!favoritesOnly || saved.favorite) && saved.metrics.distanceKm <= maxSavedDistance)
    .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || (savedSort === 'name' ? a.name.localeCompare(b.name, locale) : savedSort === 'distance' ? b.metrics.distanceKm - a.metrics.distanceKm : new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()))

  const persistedRoute = route ? savedRoutes.find((saved) => saved.id === route.id) : undefined
  const currentSyncState = route ? routeSyncStates[route.id] ?? 'local' : 'local'
  const hasUnsavedChanges = Boolean(route && (currentSyncState === 'error' || !persistedRoute || routeSignature(route) !== routeSignature(persistedRoute)))
  useEffect(() => {
    const protectUpdate = (event: Event) => {
      if (hasUnsavedChanges || saving || isPlanning || homePending || (!route && waypoints.length > 0)) event.preventDefault()
    }
    window.addEventListener(PWA_UPDATE_CHECK, protectUpdate)
    return () => window.removeEventListener(PWA_UPDATE_CHECK, protectUpdate)
  }, [hasUnsavedChanges, saving, isPlanning, homePending, route, waypoints.length])
  const saveStatus = currentSyncState === 'error' ? (locale === 'de' ? 'Nicht gesichert' : 'Not saved') : currentSyncState === 'conflict' ? (locale === 'de' ? 'Konflikt · lokal' : 'Conflict · local') : currentSyncState === 'syncing' ? (locale === 'de' ? 'Synchronisiert …' : 'Syncing …') : hasUnsavedChanges ? (locale === 'de' ? 'Ungespeichert' : 'Unsaved') : currentSyncState === 'synced' ? (locale === 'de' ? 'Cloud synchronisiert' : 'Cloud synced') : (locale === 'de' ? 'Lokal · Cloud ausstehend' : 'Local · cloud pending')
  async function confirmDiscard() {
    return !(hasUnsavedChanges || saving) || askConfirmation(locale === 'de' ? 'Ungesicherte Änderungen oder ein laufender Speichervorgang sind vorhanden. Diesen Entwurf wirklich verlassen?' : 'There are unsaved changes or a save in progress. Really leave this draft?')
  }
  useEffect(() => {
    if (!hasUnsavedChanges && !saving) return
    const protectDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [hasUnsavedChanges, saving])
  const isGpxImport = route?.provenance.routingEngine === 'GPX Import'

  function toggleTheme() { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); localStorage.setItem(THEME_KEY, next) }
  async function importGpx(file: File) {
    const de = locale === 'de'
    try {
      if (file.size > MAX_GPX_FILE_BYTES) throw new Error('file-too-large')
      const imported = parseGpx(await file.text(), file.name, locale, profile)
      if (!(await confirmDiscard())) return
      cancelPlanning()
      setRoute(imported); dispatchWaypoints({ type: 'reset', waypoints: imported.waypoints }); setMode(imported.mode)
      setDistance(Math.max(5, Math.min(250, Math.round(imported.metrics.distanceKm / 5) * 5)))
      setShowRouteDetails(true); setActiveProfileIndex(null); setPlannerOpen(false)
      setNotice(de ? `„${imported.name}“ importiert.` : `Imported “${imported.name}”.`)
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
  async function openSavedRoute(saved: PlannedRoute) {
    if (!(await confirmDiscard())) return
    cancelPlanning()
    const editable = ensureEditableAnchors(saved)
    setRoute(editable); dispatchWaypoints({ type: 'reset', waypoints: editable.waypoints }); setMode(editable.mode); setProfile(editable.profile); setShowSaved(false); setPlannerOpen(false)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = locale === 'de' ? 'de-CH' : 'en'
  }, [theme, locale])

  return <main id="planner" className={`app-shell theme-${theme} ${plannerOpen ? 'has-planner' : ''} ${route && routeDetailsExpanded && !compactViewport ? 'has-expanded-route' : ''}`}>
    <a href="#planner-controls" className="skip-link">{locale === 'de' ? 'Zur Routenplanung' : 'Skip to route planning'}</a>
    <MapCanvas theme={theme} activeRoute={route} savedRoutes={savedRoutes} waypoints={waypoints} onMapClick={handleMapClick} onWaypointMove={handleWaypointMove} onRouteShape={handleRouteShape} activeProfileIndex={activeProfileIndex} onActiveProfileIndexChange={setActiveProfileIndex} locale={locale} />

    <header className="topbar">
      <button className="brand" onClick={reset} aria-label={locale === 'de' ? 'Velvetia Startseite' : 'Velvetia home'}>
        <BrandLogo theme={theme} />
      </button>
      <span className="brand-slogan">Plan less. Ride more.</span>
      <nav aria-label={locale === 'de' ? 'Hauptnavigation' : 'Main navigation'}>
        <button className={`nav-button ${!showSaved ? 'is-active' : ''}`} onClick={() => { setShowSaved(false); setPlannerOpen(true) }}><RouteIcon size={18} /> {copy.planner}</button>
        <button className="nav-button" onClick={() => setShowSaved(true)}><Bookmark size={18} /> {copy.saved}<span className="count">{savedRoutes.length}</span></button>
      </nav>
      <div className="topbar-actions">
        <AccountMenu locale={locale} />
        <button className="icon-button mobile-saved-button" onClick={() => setShowSaved(true)} aria-label={copy.saved}><Bookmark size={18} /><span className="count">{savedRoutes.length}</span></button>
        <button className="icon-button labelled" onClick={() => setShowGuide(true)}><CircleHelp size={19} /><span>{copy.guide}</span></button>
        <Button variant="icon" onClick={toggleTheme} aria-label={theme === 'light' ? (locale === 'de' ? 'Dunkles Design' : 'Dark theme') : (locale === 'de' ? 'Helles Design' : 'Light theme')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</Button>
        <Button variant="icon" onClick={() => setLocale(locale === 'de' ? 'en' : 'de')} aria-label={locale === 'de' ? 'Sprache wechseln' : 'Switch language'}><Languages size={19} /><b>{locale.toUpperCase()}</b></Button>
      </div>
    </header>

    <button className={`mobile-panel-toggle ${plannerOpen ? 'is-panel-open' : ''}`} aria-expanded={plannerOpen} aria-controls="planner-controls" onClick={() => setPlannerOpen(!plannerOpen)} aria-label={plannerOpen ? (locale === 'de' ? 'Planungsmenü schliessen' : 'Close planning menu') : (locale === 'de' ? 'Planungsmenü öffnen' : 'Open planning menu')}><SlidersHorizontal size={17} aria-hidden="true" /><span>{locale === 'de' ? 'Planung' : 'Plan'}</span><ChevronDown className="panel-toggle-chevron" size={14} aria-hidden="true" /></button>

    {route ? <div className="route-edit-hint" role="note"><MousePointer2 size={17} /><span>{locale === 'de' ? (compactViewport ? 'Linie antippen oder ziehen' : 'Route bearbeiten: Linie ziehen oder antippen') : (compactViewport ? 'Tap or drag the line' : 'Edit route: drag or tap the line')}</span></div> : null}

    <aside id="planner-controls" tabIndex={-1} inert={!plannerOpen} className={`planner-panel ${plannerOpen ? 'is-open' : ''}`} aria-label={locale === 'de' ? 'Routeneinstellungen' : 'Route settings'}>
      <div className="panel-intro"><p className="eyebrow">{locale === 'de' ? 'Schweizer Routenplaner' : 'Swiss route planner'}</p><h1>{locale === 'de' ? 'Wohin möchtest du fahren?' : 'Where do you want to ride?'}</h1><p>{locale === 'de' ? 'Suche deinen Startort oder wähle ihn auf der Karte.' : 'Search for your starting point or choose it on the map.'}</p></div>

      <div className="segmented-control" aria-label={locale === 'de' ? 'Routentyp' : 'Route type'}>
        <button className={mode === 'round-trip' ? 'is-active' : ''} aria-pressed={mode === 'round-trip'} onClick={() => changeMode('round-trip')}>{copy.roundTrip}</button>
        <button className={mode === 'one-way' ? 'is-active' : ''} aria-pressed={mode === 'one-way'} onClick={() => changeMode('one-way')}>{copy.oneWay}</button>
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
          {waypointSummary.length ? waypointSummary.map((text, index) => <div className="location-row" key={visibleWaypoints[index].id}><span className={`location-dot ${visibleWaypoints[index].kind}`} /> <span>{text}</span><button onClick={() => removeWaypoint(visibleWaypoints[index].id)} aria-label={`${visibleWaypoints[index].label} ${locale === 'de' ? 'entfernen' : 'remove'}`}><X size={14} /></button></div>) : <button className="map-prompt" onClick={() => { setPlannerOpen(false); window.requestAnimationFrame(() => document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')?.focus()) }}><MapPin size={18} /> {copy.mapHint}</button>}
        </div>
        <div className="editor-toolbar" aria-label={locale === 'de' ? 'Bearbeitungsverlauf' : 'Edit history'}>
          <button onClick={undoWaypoints} disabled={!waypointHistory.past.length}><Undo2 size={15} />{locale === 'de' ? 'Rückgängig' : 'Undo'}</button>
          <button onClick={redoWaypoints} disabled={!waypointHistory.future.length}><Redo2 size={15} />{locale === 'de' ? 'Wiederholen' : 'Redo'}</button>
        </div>
      </section>

      <section className="form-section">
        <div className="section-heading"><span>02</span><h2>{copy.bike}</h2></div>
        <div className="profile-grid">{profiles.map(({ id, icon: Icon }) => <button key={id} className={profile === id ? 'profile-card is-active' : 'profile-card'} aria-pressed={profile === id} onClick={() => setProfile(id)}><Icon size={21} /><span>{copy[id]}</span>{profile === id && <Check size={15} />}</button>)}</div>
      </section>

      {mode === 'round-trip' && <section className="form-section distance-section">
        <div className="section-heading"><span>03</span><h2>{copy.distance}</h2><strong>{distance} km</strong></div>
        <input type="range" min="5" max="250" step="5" value={distance} onChange={(event) => setDistance(Number(event.target.value))} aria-label={`${copy.distance}: ${distance} km`} />
        <div className="range-labels"><span>5 km</span><span>250 km</span></div>
      </section>}

      <button className={`advanced-button ${showAdvanced ? 'is-open' : ''}`} onClick={() => setShowAdvanced(!showAdvanced)} aria-expanded={showAdvanced}>{locale === 'de' ? 'Erweiterte Wünsche' : 'Advanced preferences'} <ChevronDown size={17} /></button>
      {showAdvanced && <div className="advanced-panel">
        <PreferenceSelect label={locale === 'de' ? 'Untergrund' : 'Surface'} value={preferences.surface} onChange={(surface) => setPreferences({ ...preferences, surface })} options={[
          ['mostly-paved', locale === 'de' ? 'Möglichst Asphalt' : 'Mostly paved'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['unpaved-friendly', locale === 'de' ? 'Mehr Naturwege' : 'More unpaved'],
        ]} />
        <PreferenceSelect label={locale === 'de' ? 'Steigungen' : 'Climbing'} value={preferences.climbing} onChange={(climbing) => setPreferences({ ...preferences, climbing })} options={[
          ['avoid', locale === 'de' ? 'Eher flach' : 'Prefer flat'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['challenge', locale === 'de' ? 'Herausforderung' : 'Challenge'],
        ]} />
        <PreferenceSelect label={locale === 'de' ? 'Strassenwahl' : 'Road choice'} value={preferences.safety} onChange={(safety) => setPreferences({ ...preferences, safety })} options={[
          ['quiet', locale === 'de' ? 'Ruhige Strassen' : 'Quiet roads'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['direct', locale === 'de' ? 'Möglichst direkt' : 'Most direct'],
        ]} />
      </div>}
      <div className="planner-footer">
      <Button variant="primary" className="plan-button" onClick={planRoute} disabled={isPlanning}>{isPlanning ? <><span className="spinner" />{copy.planning}</> : <><Sparkles size={19} />{copy.calculate}</>}</Button>
      <label className="secondary-button import-button"><FileUp size={18} />{locale === 'de' ? 'GPX importieren' : 'Import GPX'}<input ref={gpxInputRef} className="sr-only" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" aria-label={locale === 'de' ? 'GPX-Datei auswählen' : 'Choose GPX file'} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importGpx(file) }} /></label>
      </div>
    </aside>

    {route && <section className={`route-summary ${routeDetailsExpanded && !compactViewport ? 'is-expanded' : ''}`} aria-label={locale === 'de' ? 'Routenzusammenfassung' : 'Route summary'}>
      <div className="route-summary-head"><div><p className="eyebrow">{copy.routeReady}</p><input className="route-name-input" value={route.name} maxLength={80} aria-label={locale === 'de' ? 'Routenname' : 'Route name'} onChange={(event) => setRoute({ ...route, name: event.target.value })} /><textarea className="route-description-input" value={route.description ?? ''} maxLength={300} rows={1} placeholder={locale === 'de' ? 'Beschreibung hinzufügen …' : 'Add a description …'} aria-label={locale === 'de' ? 'Routenbeschreibung' : 'Route description'} onChange={(event) => setRoute({ ...route, description: event.target.value })} /></div><div className="route-statuses"><span data-state={currentSyncState} className={`save-status ${hasUnsavedChanges ? 'is-dirty' : ''}`}>{saveStatus}</span><span className={`preview-badge ${route.metrics.confidence === 'verified' ? 'is-verified' : ''}`}>{isGpxImport ? 'GPX Import' : route.metrics.confidence === 'verified' ? (locale === 'de' ? 'OSM-Routing' : 'OSM routing') : copy.preview}</span><button className="route-expand-toggle" onClick={() => { const expanded = !routeDetailsExpanded; setRouteDetailsExpanded(expanded); if (expanded) { setShowRouteDetails(true); setPlannerOpen(false) } }} aria-pressed={routeDetailsExpanded} aria-label={routeDetailsExpanded ? (locale === 'de' ? 'Kompakte Detailansicht' : 'Compact detail view') : (locale === 'de' ? 'Grosse Detailansicht neben der Karte' : 'Large detail view beside the map')}>{routeDetailsExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{routeDetailsExpanded ? (locale === 'de' ? 'Kompakt' : 'Compact') : (locale === 'de' ? 'Alle Details' : 'All details')}</span></button><button className={`route-detail-toggle ${showRouteDetails ? 'is-open' : ''}`} onClick={() => setShowRouteDetails(!showRouteDetails)} aria-expanded={showRouteDetails} aria-label={showRouteDetails ? (locale === 'de' ? 'Routendetails ausblenden' : 'Hide route details') : (locale === 'de' ? 'Routendetails einblenden' : 'Show route details')}><ChevronDown size={16} /><span>{showRouteDetails ? (locale === 'de' ? 'Details ausblenden' : 'Hide details') : (locale === 'de' ? 'Details anzeigen' : 'Show details')}</span></button></div></div>
      {showRouteDetails && <RouteDetails route={route} locale={locale} speedKmh={speedKmh} activeIndex={activeProfileIndex} onActiveIndexChange={setActiveProfileIndex} condensed={!routeDetailsExpanded || compactViewport} />}
      {!routeDetailsExpanded && route.warnings.length > 0 && <button className="route-warning-summary" onClick={() => { setRouteDetailsExpanded(true); setPlannerOpen(false) }}>{locale === 'de' ? `${route.warnings.length} Hinweise zur Route · in den Details prüfen` : `${route.warnings.length} route notes · review in details`}</button>}
      <RouteActions key={route.id} route={route} locale={locale} saving={saving} saved={Boolean(persistedRoute)} canShare={Boolean(persistedRoute?.serverVersion && accountAuthenticated)} onSave={saveRoute} onReset={reset} />
      {syncConflict && <button className="account-link" onClick={() => window.location.reload()}>{locale === 'de' ? 'Aktuellen Serverstand neu laden (lokale Änderungen vorher als Kopie speichern)' : 'Reload server version (save local changes as a copy first)'}</button>}
    </section>}

    <AppDialog open={showSaved} onOpenChange={setShowSaved} label={copy.saved} className="saved-drawer" placement="end">
      <div className="drawer-head"><div><p className="eyebrow">Velvetia</p><h2>{copy.saved}</h2><span className={`persistence-status is-${persistenceState}`}>{persistenceState === 'server' ? accountAuthenticated ? (locale === 'de' ? 'Mit deinem Konto synchronisiert' : 'Synced with your account') : (locale === 'de' ? 'Anonymer Cloud-Speicher' : 'Anonymous cloud storage') : persistenceState === 'checking' ? (locale === 'de' ? 'Speicher wird geprüft …' : 'Checking storage …') : (locale === 'de' ? 'Lokaler Speicher' : 'Local storage')}</span></div><Button variant="icon" onClick={() => setShowSaved(false)} aria-label={locale === 'de' ? 'Schliessen' : 'Close'}><X /></Button></div>
      {savedRoutes.length > 0 && <div className="saved-tools"><label className="saved-search"><Search size={16} /><span className="sr-only">{locale === 'de' ? 'Routen suchen' : 'Search routes'}</span><input value={savedSearch} onChange={(event) => setSavedSearch(event.target.value)} placeholder={locale === 'de' ? 'Routen suchen' : 'Search routes'} /></label><select value={savedSort} onChange={(event) => setSavedSort(event.target.value as typeof savedSort)} aria-label={locale === 'de' ? 'Routen sortieren' : 'Sort routes'}><option value="updated">{locale === 'de' ? 'Zuletzt geändert' : 'Last edited'}</option><option value="name">{locale === 'de' ? 'Name' : 'Name'}</option><option value="distance">{locale === 'de' ? 'Distanz' : 'Distance'}</option></select></div>}
      {savedRoutes.length > 0 && <div className="saved-filters"><select value={savedProfile} onChange={(e) => setSavedProfile(e.target.value)} aria-label={locale === 'de' ? 'Fahrradtyp filtern' : 'Filter bike type'}><option value="all">{locale === 'de' ? 'Alle Fahrräder' : 'All bikes'}</option>{profiles.map(({ id }) => <option key={id} value={id}>{copy[id]}</option>)}</select><button className={favoritesOnly ? 'is-active' : ''} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Star size={15} />{locale === 'de' ? 'Favoriten' : 'Favorites'}</button><label>{locale === 'de' ? 'Bis' : 'Up to'} <select aria-label={locale === 'de' ? 'Maximale Distanz' : 'Maximum distance'} value={maxSavedDistance} onChange={(e) => setMaxSavedDistance(Number(e.target.value))}>{[25, 50, 100, 250, 500].map((km) => <option key={km} value={km}>{km} km</option>)}</select></label></div>}
      {savedRoutes.length === 0 ? <div className="empty-state"><Bookmark size={28} /><h3>{locale === 'de' ? 'Noch keine gespeicherten Routen' : 'No saved routes yet'}</h3><p>{locale === 'de' ? 'Gespeicherte Routen findest du hier und auf der Karte.' : 'Routes you save appear here and on the map.'}</p><button className="primary-button" onClick={() => { setShowSaved(false); setPlannerOpen(true) }}>{copy.calculate}</button></div> : visibleSavedRoutes.length === 0 ? <div className="empty-state"><Search size={28} /><h3>{locale === 'de' ? 'Keine passenden Routen' : 'No matching routes'}</h3><button className="account-link" onClick={() => { setSavedSearch(''); setSavedProfile('all'); setFavoritesOnly(false); setMaxSavedDistance(500) }}>{locale === 'de' ? 'Filter zurücksetzen' : 'Reset filters'}</button></div> : <div className="saved-list">{visibleSavedRoutes.map((saved) => <article key={saved.id}>
          <button className="saved-main" onClick={() => openSavedRoute(saved)}><span className="saved-route-icon"><RouteThumbnail route={saved} /></span><span><strong>{saved.name}</strong><small>{copy[saved.profile]} · {saved.metrics.distanceKm} km · {formatDuration(saved.metrics.durationMinutes)}</small></span><ChevronDown className="saved-chevron" /></button>
        <div className="saved-actions">
          <Button variant="icon" className={saved.favorite ? 'is-favorite' : ''} aria-pressed={Boolean(saved.favorite)} onClick={() => void toggleFavorite(saved)} aria-label={locale === 'de' ? 'Favorit umschalten' : 'Toggle favorite'}><Star size={17} fill={saved.favorite ? 'currentColor' : 'none'} /></Button>
          <Button variant="icon" onClick={() => void showVersions(saved.id)} aria-expanded={historyRouteId === saved.id} aria-label={locale === 'de' ? 'Versionsverlauf' : 'Version history'}><History size={17} /></Button>
          <Button variant="icon" onClick={() => void duplicateRoute(saved)} aria-label={locale === 'de' ? 'Route duplizieren' : 'Duplicate route'}><Copy size={17} /></Button>
          <Button variant="icon" className={`saved-delete ${pendingDelete === saved.id ? 'is-delete-confirm' : ''}`} onClick={() => { if (pendingDelete === saved.id) void deleteRoute(saved.id); else setPendingDelete(saved.id) }} aria-label={pendingDelete === saved.id ? (locale === 'de' ? 'Löschen bestätigen' : 'Confirm delete') : (locale === 'de' ? 'Route löschen' : 'Delete route')}>{pendingDelete === saved.id ? <Check size={17} /> : <Trash2 size={17} />}</Button>
        </div>
        {historyRouteId === saved.id ? <div className="version-history">{historyLoading ? <span>{locale === 'de' ? 'Versionen werden geladen …' : 'Loading versions …'}</span> : routeVersions.length ? routeVersions.map((version) => <button key={version.version} onClick={() => void restoreVersion(version)}><span><b>v{version.version}</b>{new Date(version.savedAt).toLocaleString(locale === 'de' ? 'de-CH' : 'en-GB')}</span><RotateCcw size={14} /><span className="sr-only">{locale === 'de' ? 'wiederherstellen' : 'restore'}</span></button>) : <span>{locale === 'de' ? 'Noch keine Serverversionen.' : 'No server versions yet.'}</span>}</div> : null}
      </article>)}</div>}
    </AppDialog>
    <AppDialog open={Boolean(route && routeDetailsExpanded && compactViewport)} onOpenChange={(open) => { if (!open) setRouteDetailsExpanded(false) }} label={locale === 'de' ? 'Alle Routendetails' : 'All route details'} className="route-detail-dialog" placement="sheet">
      {route && <><div className="dialog-heading"><div><p className="eyebrow">{locale === 'de' ? 'Routendetails' : 'Route details'}</p><h2>{route.name}</h2></div><Button variant="icon" onClick={() => setRouteDetailsExpanded(false)} aria-label={locale === 'de' ? 'Schliessen' : 'Close'}><X size={18} /></Button></div><RouteDetails route={route} locale={locale} speedKmh={speedKmh} activeIndex={activeProfileIndex} onActiveIndexChange={setActiveProfileIndex} /></>}
    </AppDialog>
    {showGuide && <Onboarding onClose={closeGuide} locale={locale} />}
    {notice && <div className="workspace-notice" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label={locale === 'de' ? 'Hinweis schliessen' : 'Dismiss notice'}><X size={17} /></button></div>}

    {confirmation}
    <footer className="font-credit">Fonts made from <a href="http://www.onlinewebfonts.com" target="_blank" rel="noreferrer">Web Fonts</a> is licensed by CC BY 4.0</footer>
  </main>
}

function PreferenceSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Array<[T, string]> }) {
  return <label className="preference-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>
}
