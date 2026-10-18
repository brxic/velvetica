'use client'

import { Copy, Pencil, ListOrdered, Droplets } from 'lucide-react'
import { Bike, Bookmark, Check, ChevronDown, CircleHelp, FileUp, History, Home, Languages, MapPin, Maximize2, SlidersHorizontal, Minimize2, Moon, Navigation, Redo2, RotateCcw, Route as RouteIcon, Search, Sparkles, Star, Sun, Trash2, Undo2, X } from 'lucide-react'
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
import { useRideSession } from './use-ride-session'
import { RidePanel } from './ride-panel'
import { routingErrorMessage } from '@/lib/routing/errors'
import { useWorkspaceRecovery } from './use-workspace-recovery'
import { resolveWorkspaceIdentity } from '@/lib/workspace-identity-client'
import { WaypointEditor } from './waypoint-editor'
import { usePanelBack } from './use-panel-back'
import { useVisualViewport } from './use-visual-viewport'
import { useSupply } from './use-supply'
import { SupplyPanel } from './supply-panel'
import { PlannerPanel } from './planner-panel'
import { MobileAppMenu } from './mobile-app-menu'
import { supplyLabels, type SupplyCategory } from '@/lib/supply'

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
function storedPreference(key: string) { try { return localStorage.getItem(key) } catch { return null } }
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
  useVisualViewport()
  const ride = useRideSession()
  const [rideSetup, setRideSetup] = useState(false)
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
  const [genericRouter, setGenericRouter] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/routing/config', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return
      const config = await response.json() as { provider: string }
      if (!controller.signal.aborted) setGenericRouter(config.provider === 'fossgis')
    }).catch(() => undefined)
    return () => controller.abort()
  }, [])
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
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null)
  const editing = Boolean(route && editingRouteId === route.id)
  const supply = useSupply(route, preferences, locale)
  const supplyVisible = Boolean(route && supply.open && !plannerOpen && !editing && !ride.route && !showSaved && !rideSetup && !routeDetailsExpanded)
  const [stopSnapshots, setStopSnapshots] = useState(new Map<string, PlannedRoute>())
  const stopKey = (value: PlannedRoute) => `${value.id}:${JSON.stringify(value.waypoints)}`
  const beforeStop = route && waypointHistory.past.length ? stopSnapshots.get(`${route.id}:${JSON.stringify(waypointHistory.past.at(-1))}`) : undefined
  const canUndoStop = Boolean(route && beforeStop && stopSnapshots.get(stopKey(route))?.geometry === route.geometry)
  function acceptSupplyStop(candidate: PlannedRoute) {
    if (!route || !supply.quote?.value || supply.quote.value.route !== candidate) return
    setStopSnapshots((current) => { const next = new Map(current); next.set(stopKey(route), route); next.set(stopKey(candidate), candidate); if (next.size > 40) next.delete(next.keys().next().value!); return next })
    dispatchWaypoints({ type: 'commit', waypoints: candidate.waypoints }); setRoute({ ...candidate, name: route.name, description: route.description, serverVersion: route.serverVersion, favorite: route.favorite }); supply.close()
    setNotice(locale === 'de' ? 'Stopp eingefügt. Die Route ist noch nicht gespeichert.' : 'Stop added. The route has not been saved yet.')
  }
  const [waypointEditorOpen, setWaypointEditorOpen] = useState(false)
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null)
  const [focusWarnings, setFocusWarnings] = useState(false)
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
  // An in-flight edit is not a complete route. Recover the last routed anchors.
  const workspace = useMemo(() => ({ route, mode, profile, distance, preferences, waypoints: route?.waypoints ?? waypoints }), [route, mode, profile, distance, preferences, waypoints])
  const activeWorkspaceRef = useRef(workspace)
  useEffect(() => { activeWorkspaceRef.current = workspace }, [workspace])
  const recovery = useWorkspaceRecovery(workspace)

  async function recoverWorkspace(restore: boolean) {
    if (restore && (route || waypoints.length > 0) && !(await askConfirmation(locale === 'de' ? 'Den aktuellen Arbeitsbereich durch den wiederhergestellten Entwurf ersetzen?' : 'Replace the current workspace with the recovered draft?'))) return
    const draft = recovery.takeRecovery(restore)
    if (!draft) return
    cancelPlanning()
    setRoute(draft.route); setMode(draft.mode); setProfile(draft.profile); setDistance(draft.distance); setPreferences(draft.preferences)
    dispatchWaypoints({ type: 'reset', waypoints: draft.waypoints })
    setPlannerOpen(!draft.route); setShowGuide(false)
    setNotice(locale === 'de' ? 'Entwurf auf diesem Gerät wiederhergestellt. Nicht automatisch in der Cloud gespeichert.' : 'Draft recovered on this device. It has not been saved to the cloud automatically.')
  }

  useEffect(() => {
    const loadCloudState = async (includeLegacy: boolean) => {
      const loadId = ++cloudLoadRef.current
      const workspaceAtLoad = activeWorkspaceRef.current
      let local = includeLegacy ? readStoredRoutes(LEGACY_STORAGE_KEY) : []
      try {
        await resolveWorkspaceIdentity().catch(() => undefined)
        if (loadId !== cloudLoadRef.current) return
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
        try { localStorage.removeItem(LEGACY_STORAGE_KEY) } catch { /* Cloud state remains usable when local storage is blocked. */ }
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
          if (!activeRouteRef.current && !activeWorkspaceRef.current.waypoints.length && activeWorkspaceRef.current === workspaceAtLoad) { setProfile(defaults.profile); setDistance(defaults.distanceKm); setPreferences({ surface: defaults.surface, climbing: defaults.climbing, safety: defaults.safety }) }
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
      setSavedRoutes(local); setShowGuide(!storedPreference(GUIDE_KEY)); setTheme(storedPreference(THEME_KEY) === 'dark' ? 'dark' : 'light')
      void loadCloudState(true)
    }, 0)
    const handleAuthChange = () => {
      identityEpochRef.current++
      setRouteSyncStates({})
      activeRouteRef.current = null
      historyLoadRef.current++; setHistoryRouteId(null); setRouteVersions([])
      routeRequestRef.current?.abort(); routeRequestRef.current = null; setIsPlanning(false); setRoute(null); setSavedRoutes([]); setHomePoint(null); setShowSaved(false); setAccountAuthenticated(false)
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
    if (route && !editing) return
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
    if (!valid) { setNotice(copy.noStart); if (preserveExisting && activeRouteRef.current) dispatchWaypoints({ type: 'rollback', waypoints: activeRouteRef.current.waypoints }); return false }
    routeRequestRef.current?.abort()
    const controller = new AbortController(); routeRequestRef.current = controller
    const previous = activeRouteRef.current
    setIsPlanning(true); setNotice(null)
    try {
      const response = await fetch('/api/routes/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale, profile, mode, targetDistanceKm: distance, waypoints: points, preferences }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55_000)]) })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string' ? payload.code : 'ROUTE_FAILED')
      const parsed = plannedRouteSchema.safeParse(payload)
      if (!parsed.success) throw new Error('ROUTE_QUALITY_FAILED')
      const planned = parsed.data
      if (routeRequestRef.current !== controller) return
      setRoute((current) => preserveExisting && current ? { ...planned, id: current.id, name: current.name, description: current.description, createdAt: current.createdAt, updatedAt: current.updatedAt, favorite: current.favorite, serverVersion: current.serverVersion } : planned)
      dispatchWaypoints({ type: preserveExisting ? 'replace' : 'reset', waypoints: planned.waypoints })
      setActiveProfileIndex(null); setPlannerOpen(false)
      return true
    } catch (error) {
      if (routeRequestRef.current !== controller || controller.signal.aborted) return
      const code = error instanceof DOMException && error.name === 'TimeoutError' ? 'ROUTER_TIMEOUT' : error instanceof TypeError ? 'ROUTER_UNAVAILABLE' : error instanceof Error ? error.message : 'ROUTE_FAILED'
      setNotice(routingErrorMessage(code, locale))
      if (previous) {
        // Keep map, markers, export and recovery on the same last complete route.
        dispatchWaypoints({ type: 'rollback', waypoints: previous.waypoints })
        setPlannerOpen(false)
      }
      return false
    }
    finally { if (routeRequestRef.current === controller) { routeRequestRef.current = null; setIsPlanning(false) } }
  }

  async function planRoute() { if (await confirmDiscard()) await requestRoute(waypoints, false) }

  function startEditing() { if (!route) return; setEditingRouteId(route.id); setPlannerOpen(false); setRouteDetailsExpanded(false); setNotice(null); window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.edit-waypoints-button')?.focus()) }
  function finishEditing() { if (isPlanning) return; setEditingRouteId(null); setWaypointEditorOpen(false); window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.edit-route-button')?.focus()) }
  function openWaypointEditor(id: string | null = null) { setSelectedWaypointId(id ?? waypoints.find((point) => point.kind !== 'generated')?.id ?? null); setWaypointEditorOpen(true); setNotice(null) }
  async function changeEditorPoint(id: string, place: { label: string; coordinate: [number, number] }) {
    const next = waypoints.map((point) => point.id === id ? { ...point, ...place } : point)
    dispatchWaypoints({ type: 'commit', waypoints: next })
    return Boolean(await requestRoute(next, true))
  }
  async function addEditorPoint(place: { label: string; coordinate: [number, number] }) {
    if (waypoints.length >= 20) return false
    const point: Waypoint = { id: crypto.randomUUID(), ...place, kind: 'via' }
    const next = [...waypoints]
    const end = next.findIndex((point) => point.kind === 'end')
    next.splice(end < 0 ? next.length : end, 0, point)
    dispatchWaypoints({ type: 'commit', waypoints: next })
    const success = Boolean(await requestRoute(next, true))
    if (success) setSelectedWaypointId(point.id)
    return success
  }
  function reorderEditorPoint(id: string, direction: -1 | 1) {
    const editable = waypoints.filter((point) => point.kind === 'via' || point.kind === 'shaping')
    const neighbor = editable[editable.findIndex((point) => point.id === id) + direction]
    if (!neighbor) return
    const next = [...waypoints], from = next.findIndex((point) => point.id === id), to = next.findIndex((point) => point.id === neighbor.id)
    ;[next[from], next[to]] = [next[to], next[from]]
    dispatchWaypoints({ type: 'commit', waypoints: next }); void requestRoute(next, true)
  }
  function openWarnings() { setFocusWarnings(true); setRouteDetailsExpanded(true); setShowRouteDetails(true); setPlannerOpen(false) }
  function toggleExpandedDetails() { const expanded = !routeDetailsExpanded; setFocusWarnings(false); setRouteDetailsExpanded(expanded); if (expanded) { setShowRouteDetails(true); setPlannerOpen(false) } }

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
    if (!name) { setNotice(locale === 'de' ? 'Bitte gib der Route einen Namen.' : 'Please give the route a name.'); document.querySelector<HTMLInputElement>('.route-name-input')?.focus(); return }
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

  function cancelPlanning() { if (routeRequestRef.current && activeRouteRef.current) dispatchWaypoints({ type: 'rollback', waypoints: activeRouteRef.current.waypoints }); routeRequestRef.current?.abort(); routeRequestRef.current = null; setIsPlanning(false); setActiveProfileIndex(null); setEditingRouteId(null); setWaypointEditorOpen(false) }
  async function reset() { if (!(await confirmDiscard())) return; cancelPlanning(); setRoute(null); dispatchWaypoints({ type: 'reset' }); setNotice(null); setSyncConflict(false); setPlannerOpen(true); setRouteDetailsExpanded(false); const defaults = accountDefaultsRef.current; setProfile(defaults.profile); setDistance(defaults.distanceKm); setPreferences({ surface: defaults.surface, climbing: defaults.climbing, safety: defaults.safety }) }
  async function changeMode(nextMode: RouteMode) { if (nextMode === mode || !(await confirmDiscard())) return; cancelPlanning(); setMode(nextMode); setRoute(null); dispatchWaypoints({ type: 'commit', waypoints: waypoints.filter((point) => point.kind === 'start') }) }
  function closeGuide() { setShowGuide(false); try { localStorage.setItem(GUIDE_KEY, 'true') } catch { /* The guide can still be dismissed in this session. */ } }

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
  function restoreStopSnapshot(next: Waypoint[]) { const snapshot = route && stopSnapshots.get(`${route.id}:${JSON.stringify(next)}`); if (!snapshot || !route) return false; setRoute({ ...snapshot, name: route.name, description: route.description, favorite: route.favorite, serverVersion: route.serverVersion, updatedAt: route.updatedAt }); return true }
  function undoWaypoints() { const next = waypointHistory.past.at(-1); if (!next) return; dispatchWaypoints({ type: 'undo' }); if (route) { if (!restoreStopSnapshot(next)) void requestRoute(next, true) } else setRoute(null) }
  function redoWaypoints() { const next = waypointHistory.future[0]; if (!next) return; dispatchWaypoints({ type: 'redo' }); if (route) { if (!restoreStopSnapshot(next)) void requestRoute(next, true) } else setRoute(null) }

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
  const isGpxImport = route?.provenance.routingEngine.startsWith('GPX')

  function toggleTheme() { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); try { localStorage.setItem(THEME_KEY, next) } catch { /* Theme remains usable without persistence. */ } }
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

  const backPanel = rideSetup ? 'ride-setup' : ride.route ? 'ride' : waypointEditorOpen && editing ? 'waypoints' : showSaved ? 'library' : routeDetailsExpanded && compactViewport ? 'details' : showGuide ? 'guide' : supplyVisible ? 'supply' : editing ? 'editing' : compactViewport && plannerOpen && (route || waypoints.length) ? 'planning' : null
  usePanelBack(backPanel, () => {
    if (rideSetup) setRideSetup(false)
    else if (ride.route) ride.stop()
    else if (waypointEditorOpen && editing) setWaypointEditorOpen(false)
    else if (showSaved) setShowSaved(false)
    else if (routeDetailsExpanded && compactViewport) setRouteDetailsExpanded(false)
    else if (showGuide) closeGuide()
    else if (supplyVisible) supply.close()
    else if (editing) { if (isPlanning) cancelPlanning(); setEditingRouteId(null) }
    else setPlannerOpen(false)
  })
  useEffect(() => {
    if (!editing) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[role="dialog"], [role="alertdialog"]') && !isPlanning) {
        setEditingRouteId(null)
        window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.edit-route-button')?.focus())
      }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [editing, isPlanning])

  return <main id="planner" className={`app-shell theme-${theme} ${ride.route ? 'is-riding' : ''} ${editing ? 'is-editing' : ''} ${supplyVisible ? 'has-supply-panel' : ''} ${plannerOpen ? 'has-planner' : ''} ${route && routeDetailsExpanded && !compactViewport ? 'has-expanded-route' : ''}`}>
    <a href="#planner-controls" className="skip-link">{locale === 'de' ? 'Zur Routenplanung' : 'Skip to route planning'}</a>
    <MapCanvas theme={theme} activeRoute={ride.route ?? (supplyVisible ? supply.quote?.value?.route : null) ?? route} comparisonRoute={supplyVisible && supply.quote?.value ? route : null} savedRoutes={savedRoutes} waypoints={ride.route?.waypoints ?? (supplyVisible ? supply.quote?.value?.route.waypoints : undefined) ?? waypoints} onMapClick={handleMapClick} onWaypointMove={handleWaypointMove} onRouteShape={handleRouteShape} activeProfileIndex={supplyVisible && supply.quote?.value ? null : activeProfileIndex} onActiveProfileIndexChange={setActiveProfileIndex} locale={locale} riding={Boolean(ride.route)} rideFix={ride.fresh ? ride.fix : null} following={ride.following} onFollowChange={ride.setFollowing} editing={editing || !route} onWaypointSelect={openWaypointEditor} supplyPois={supply.enabled && !editing && !ride.route ? supply.result?.pois : undefined} onSupplySelect={supply.select} />
    <RidePanel session={ride} locale={locale} />

    <header className="topbar">
      <button className="brand" onClick={reset} aria-label={locale === 'de' ? 'Velvetia Startseite' : 'Velvetia home'}>
        <BrandLogo theme={theme} />
      </button>
      <span className="brand-slogan">Plan less. Ride more.</span>
      <nav aria-label={locale === 'de' ? 'Hauptnavigation' : 'Main navigation'}>
        <button className={`nav-button ${!showSaved ? 'is-active' : ''}`} onClick={() => { cancelPlanning(); setShowSaved(false); setPlannerOpen(true) }}><RouteIcon size={18} /> {copy.planner}</button>
        <button className="nav-button" onClick={() => setShowSaved(true)}><Bookmark size={18} /> {copy.saved}<span className="count">{savedRoutes.length}</span></button>
      </nav>
      <div className="topbar-actions">
        <AccountMenu locale={locale} />
        <button className="icon-button mobile-saved-button" onClick={() => setShowSaved(true)} aria-label={copy.saved}><Bookmark size={18} /><span className="count">{savedRoutes.length}</span></button>
        <button className="icon-button labelled" onClick={() => setShowGuide(true)}><CircleHelp size={19} /><span>{copy.guide}</span></button>
        <Button variant="icon" className="desktop-setting" onClick={toggleTheme} aria-label={theme === 'light' ? (locale === 'de' ? 'Dunkles Design' : 'Dark theme') : (locale === 'de' ? 'Helles Design' : 'Light theme')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</Button>
        <Button variant="icon" className="desktop-setting" onClick={() => setLocale(locale === 'de' ? 'en' : 'de')} aria-label={locale === 'de' ? 'Sprache wechseln' : 'Switch language'}><Languages size={19} /><b>{locale.toUpperCase()}</b></Button>
        <MobileAppMenu locale={locale} theme={theme} onTheme={toggleTheme} onLanguage={() => setLocale(locale === 'de' ? 'en' : 'de')} onGuide={() => setShowGuide(true)} />
      </div>
    </header>

    <button className={`mobile-panel-toggle ${plannerOpen ? 'is-panel-open' : ''}`} aria-expanded={plannerOpen} aria-controls="planner-controls" onClick={() => setPlannerOpen(!plannerOpen)} aria-label={plannerOpen ? (locale === 'de' ? 'Planungsmenü schliessen' : 'Close planning menu') : (locale === 'de' ? 'Planungsmenü öffnen' : 'Open planning menu')}><SlidersHorizontal size={17} aria-hidden="true" /><span>{locale === 'de' ? 'Planung' : 'Plan'}</span><ChevronDown className="panel-toggle-chevron" size={14} aria-hidden="true" /></button>

    {route && !ride.route ? <div className="route-edit-hint" role="toolbar" aria-label={locale === 'de' ? 'Routenbearbeitung' : 'Route editing'}>{editing ? <><span className="edit-mode-label">{locale === 'de' ? 'Bearbeiten' : 'Editing'}</span><Button className="edit-waypoints-button" onClick={() => openWaypointEditor()}><ListOrdered size={17} />{locale === 'de' ? 'Wegpunkte' : 'Waypoints'}</Button><Button variant="icon" disabled={!waypointHistory.past.length || isPlanning} onClick={undoWaypoints} aria-label={locale === 'de' ? 'Rückgängig' : 'Undo'}><Undo2 size={17} /></Button><Button variant="icon" disabled={!waypointHistory.future.length || isPlanning} onClick={redoWaypoints} aria-label={locale === 'de' ? 'Wiederholen' : 'Redo'}><Redo2 size={17} /></Button><Button variant="primary" disabled={isPlanning} onClick={finishEditing}>{locale === 'de' ? 'Fertig' : 'Done'}</Button></> : <><Button className="edit-route-button" onClick={() => { supply.close(); startEditing() }}><Pencil size={17} />{locale === 'de' ? 'Route bearbeiten' : 'Edit route'}</Button><Button variant="icon" className="supply-toggle" disabled={isPlanning} aria-label={locale === 'de' ? 'Versorgung entlang der Route' : 'Supplies along the route'} aria-pressed={supply.enabled} onClick={() => { setPlannerOpen(false); setRouteDetailsExpanded(false); supply.show() }}><Droplets size={19} /></Button></>}</div> : null}
    {editing && !ride.route && <p className="edit-instruction" role="note">{locale === 'de' ? 'Linie antippen oder ziehen. Punkte zum Ändern antippen. Danach die Route speichern.' : 'Tap or drag the line. Tap points to change them. Save the route when finished.'}</p>}

    <PlannerPanel key={String(plannerOpen)} open={plannerOpen} compact={compactViewport} locale={locale}>
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
        <div className="profile-grid">{profiles.map(({ id, icon: Icon }) => <button key={id} className={profile === id ? 'profile-card is-active' : 'profile-card'} aria-pressed={profile === id} onClick={() => { cancelPlanning(); setProfile(id) }}><Icon size={21} /><span>{copy[id]}</span>{profile === id && <Check size={15} />}</button>)}</div>
        {genericRouter && <p className="preview-note">{locale === 'de' ? 'Aktuell ist ein allgemeines Fahrradprofil aktiv. Fahrradtyp und erweiterte Wünsche ändern den Verlauf bei diesem Router nicht.' : 'A general bicycle profile is currently active. Bike type and advanced preferences do not change the route with this router.'}</p>}
      </section>

      {mode === 'round-trip' && <section className="form-section distance-section">
        <div className="section-heading"><span>03</span><h2>{copy.distance}</h2><strong>{distance} km</strong></div>
        <input type="range" min="5" max="250" step="5" value={distance} onChange={(event) => { cancelPlanning(); setDistance(Number(event.target.value)) }} aria-label={`${copy.distance}: ${distance} km`} />
        <div className="range-labels"><span>5 km</span><span>250 km</span></div>
      </section>}

      <button className={`advanced-button ${showAdvanced ? 'is-open' : ''}`} onClick={() => setShowAdvanced(!showAdvanced)} aria-expanded={showAdvanced}>{locale === 'de' ? 'Erweiterte Wünsche' : 'Advanced preferences'} <ChevronDown size={17} /></button>
      {showAdvanced && <div className="advanced-panel">
        <PreferenceSelect label={locale === 'de' ? 'Untergrund' : 'Surface'} value={preferences.surface} onChange={(surface) => { cancelPlanning(); setPreferences({ ...preferences, surface }) }} options={[
          ['mostly-paved', locale === 'de' ? 'Möglichst Asphalt' : 'Mostly paved'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['unpaved-friendly', locale === 'de' ? 'Mehr Naturwege' : 'More unpaved'],
        ]} />
        <PreferenceSelect label={locale === 'de' ? 'Steigungen' : 'Climbing'} value={preferences.climbing} onChange={(climbing) => { cancelPlanning(); setPreferences({ ...preferences, climbing }) }} options={[
          ['avoid', locale === 'de' ? 'Eher flach' : 'Prefer flat'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['challenge', locale === 'de' ? 'Herausforderung' : 'Challenge'],
        ]} />
        <PreferenceSelect label={locale === 'de' ? 'Strassenwahl' : 'Road choice'} value={preferences.safety} onChange={(safety) => { cancelPlanning(); setPreferences({ ...preferences, safety }) }} options={[
          ['quiet', locale === 'de' ? 'Ruhige Strassen' : 'Quiet roads'], ['balanced', locale === 'de' ? 'Ausgewogen' : 'Balanced'], ['direct', locale === 'de' ? 'Möglichst direkt' : 'Most direct'],
        ]} />
      </div>}
      <section className="planning-supply" aria-label={locale === 'de' ? 'Verpflegung' : 'Supplies'}>
        <label className="planning-supply-toggle"><Droplets size={18} /><span>{locale === 'de' ? 'Verpflegung auf der Karte' : 'Supplies on the map'}</span><input type="checkbox" checked={supply.enabled} onChange={(event) => supply.setEnabled(event.target.checked)} /></label>
        {supply.enabled && <><div className="supply-filters">{(['water', 'food', 'shop'] as SupplyCategory[]).map((category) => <button key={category} type="button" aria-pressed={supply.categories.includes(category)} onClick={() => supply.toggleCategory(category)}>{supplyLabels[locale][category]}</button>)}</div><p>{route ? (locale === 'de' ? 'Orte entlang der aktuellen Route.' : 'Places along the current route.') : (locale === 'de' ? 'Wird nach der Routenberechnung angezeigt.' : 'Shown once your route has been calculated.')}</p>{route && <Button variant="text" onClick={() => { setPlannerOpen(false); setRouteDetailsExpanded(false); supply.show() }}>{locale === 'de' ? 'Orte und Zwischenstopps ansehen' : 'View places and stops'}</Button>}</>}
      </section>
      <div className="planner-footer">
      <Button variant="primary" className="plan-button" onClick={planRoute} disabled={isPlanning}>{isPlanning ? <><span className="spinner" />{copy.planning}</> : <><Sparkles size={19} />{copy.calculate}</>}</Button>
      <label className="secondary-button import-button"><FileUp size={18} />{locale === 'de' ? 'GPX importieren' : 'Import GPX'}<input ref={gpxInputRef} className="sr-only" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" aria-label={locale === 'de' ? 'GPX-Datei auswählen' : 'Choose GPX file'} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importGpx(file) }} /></label>
      </div>
    </PlannerPanel>

    {route && <section className={`route-summary ${routeDetailsExpanded && !compactViewport ? 'is-expanded' : ''}`} aria-label={locale === 'de' ? 'Routenzusammenfassung' : 'Route summary'}>
      <div className="route-summary-head"><div>
        <div className="route-title-edit"><input id="route-name" className="route-name-input" value={route.name} maxLength={80} required aria-invalid={!route.name.trim()} aria-describedby={!route.name.trim() ? 'route-name-error' : undefined} aria-label={locale === 'de' ? 'Routenname' : 'Route name'} onBlur={(event) => { event.currentTarget.scrollLeft = 0 }} onChange={(event) => setRoute({ ...route, name: event.target.value })} /><Pencil size={15} aria-hidden="true" /></div>
        {!route.name.trim() && <p id="route-name-error" className="field-error">{locale === 'de' ? 'Gib der Route einen Namen, bevor du sie speicherst.' : 'Name the route before saving it.'}</p>}
        <textarea className="route-description-input" value={route.description ?? ''} maxLength={300} rows={1} placeholder={locale === 'de' ? 'Beschreibung hinzufügen …' : 'Add a description …'} aria-label={locale === 'de' ? 'Routenbeschreibung' : 'Route description'} onChange={(event) => setRoute({ ...route, description: event.target.value })} />
      </div><div className="route-statuses">
        <span data-state={currentSyncState} className={`save-status ${hasUnsavedChanges ? 'is-dirty' : ''}`}>{saveStatus}</span>
        <span className={`preview-badge ${route.metrics.confidence === 'verified' ? 'is-verified' : ''}`}>{isGpxImport ? 'GPX Import' : route.metrics.confidence === 'verified' ? (locale === 'de' ? 'OSM-Routing' : 'OSM routing') : copy.preview}</span>
        <button className="route-expand-toggle" onClick={toggleExpandedDetails} aria-pressed={routeDetailsExpanded} aria-label={routeDetailsExpanded ? (locale === 'de' ? 'Kompakte Detailansicht' : 'Compact detail view') : (locale === 'de' ? 'Grosse Detailansicht neben der Karte' : 'Large detail view beside the map')}>{routeDetailsExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{routeDetailsExpanded ? (locale === 'de' ? 'Kompakt' : 'Compact') : (locale === 'de' ? 'Alle Details' : 'All details')}</span></button>
        <button className={`route-detail-toggle ${showRouteDetails ? 'is-open' : ''}`} onClick={() => setShowRouteDetails(!showRouteDetails)} aria-expanded={showRouteDetails} aria-label={showRouteDetails ? (locale === 'de' ? 'Routendetails ausblenden' : 'Hide route details') : (locale === 'de' ? 'Routendetails einblenden' : 'Show route details')}><ChevronDown size={16} /><span>{showRouteDetails ? (locale === 'de' ? 'Details ausblenden' : 'Hide details') : (locale === 'de' ? 'Details anzeigen' : 'Show details')}</span></button>
      </div></div>
      {showRouteDetails && <RouteDetails route={route} locale={locale} speedKmh={speedKmh} activeIndex={activeProfileIndex} onActiveIndexChange={setActiveProfileIndex} condensed={!routeDetailsExpanded || compactViewport} focusWarnings={focusWarnings && !compactViewport} />}
      {!routeDetailsExpanded && route.warnings.length > 0 && <button className="route-warning-summary" onClick={openWarnings}>{locale === 'de' ? `${route.warnings.length} ${route.warnings.length === 1 ? 'Hinweis' : 'Hinweise'} zur Route · in den Details prüfen` : `${route.warnings.length} route ${route.warnings.length === 1 ? 'note' : 'notes'} · review in details`}</button>}
      <RouteActions key={route.id} route={route} locale={locale} saving={saving} saved={Boolean(persistedRoute)} canShare={Boolean(persistedRoute?.serverVersion && accountAuthenticated)} onSave={saveRoute} onReset={reset} onRide={() => setRideSetup(true)} />
      {syncConflict && <button className="account-link" onClick={() => window.location.reload()}>{locale === 'de' ? 'Aktuellen Serverstand neu laden (lokale Änderungen vorher als Kopie speichern)' : 'Reload server version (save local changes as a copy first)'}</button>}
    </section>}

    <AppDialog open={rideSetup} onOpenChange={setRideSetup} label={locale === 'de' ? 'Fahrt vorbereiten' : 'Prepare your ride'} finalFocus={() => ride.route ? document.getElementById('ride-exit') : true}>
      <div className="dialog-heading"><h2>{locale === 'de' ? 'Fahrt vorbereiten' : 'Prepare your ride'}</h2><Button variant="icon" onClick={() => setRideSetup(false)} aria-label={locale === 'de' ? 'Schliessen' : 'Close'}><X size={18} /></Button></div>
      <p className="ride-setup-copy">{locale === 'de' ? 'Zeige deinen Standort und den Fortschritt auf dieser Route. Dein Live-Standort bleibt in dieser Sitzung und wird nicht an Velvetia übertragen.' : 'Show your location and progress on this route. Your live location stays in this session and is not sent to Velvetia.'}</p>
      <p className="ride-setup-copy">{locale === 'de' ? 'Es gibt noch keine Abbiegehinweise oder automatische Neuberechnung. Bei gesperrtem Bildschirm oder im Hintergrund kann GPS aussetzen. Zum Bedienen anhalten.' : 'Turn-by-turn directions and automatic rerouting are not available. GPS may stop when the screen locks or the app is in the background. Stop before using controls.'}</p>
      {route && route.warnings.length > 0 ? <p className="ride-setup-copy">{locale === 'de' ? `Die Route enthält ${route.warnings.length} Hinweise. Prüfe diese vor der Fahrt in den Routendetails.` : `This route has ${route.warnings.length} notes. Review them in the route details before riding.`}</p> : null}
      <Button variant="primary" onClick={() => { if (route) { ride.start(route); setRideSetup(false); setActiveProfileIndex(null); setShowSaved(false); setRouteDetailsExpanded(false); setEditingRouteId(null); setWaypointEditorOpen(false) } }}>{locale === 'de' ? 'Standort freigeben und starten' : 'Allow location and start'}</Button>
    </AppDialog>
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
    <AppDialog open={Boolean(route && routeDetailsExpanded && compactViewport)} onOpenChange={(open) => { if (!open) setRouteDetailsExpanded(false) }} label={locale === 'de' ? 'Alle Routendetails' : 'All route details'} className="route-detail-dialog" placement="sheet" initialFocus={focusWarnings ? () => document.querySelector<HTMLElement>('.route-detail-dialog .route-warnings') ?? true : undefined}>
      {route && <><div className="dialog-heading"><div><p className="eyebrow">{locale === 'de' ? 'Routendetails' : 'Route details'}</p><h2>{route.name}</h2></div><Button variant="icon" onClick={() => setRouteDetailsExpanded(false)} aria-label={locale === 'de' ? 'Schliessen' : 'Close'}><X size={18} /></Button></div><RouteDetails route={route} locale={locale} speedKmh={speedKmh} activeIndex={activeProfileIndex} onActiveIndexChange={setActiveProfileIndex} focusWarnings={focusWarnings} /></>}
    </AppDialog>
    <AppDialog open={Boolean(recovery.pending) && recovery.offerOpen} onOpenChange={recovery.setOfferOpen} label={locale === 'de' ? 'Entwurf wiederherstellen' : 'Recover draft'}>
      <h2>{locale === 'de' ? 'Weiterplanen?' : 'Continue planning?'}</h2>
      <p>{locale === 'de' ? 'Auf diesem Gerät liegt ein Entwurf deiner letzten Sitzung. Er ist noch keine bestätigte Cloud-Sicherung.' : 'A draft from your last session is available on this device. It is not a confirmed cloud backup.'}</p>
      <div className="onboarding-actions"><Button variant="secondary" onClick={() => recoverWorkspace(false)}>{locale === 'de' ? 'Entwurf verwerfen' : 'Discard draft'}</Button><Button variant="primary" onClick={() => recoverWorkspace(true)}>{locale === 'de' ? 'Wiederherstellen' : 'Recover'}</Button></div>
    </AppDialog>
    {recovery.pending && !recovery.offerOpen && !notice && <div className="workspace-notice" role="status"><span>{locale === 'de' ? 'Ein älterer Entwurf liegt zur Wiederherstellung bereit. Entscheide zuerst, bevor dieser Arbeitsbereich automatisch gesichert wird.' : 'An earlier draft is available. Choose what to keep before this workspace can be saved automatically.'}</span><Button variant="secondary" onClick={() => recovery.setOfferOpen(true)}>{locale === 'de' ? 'Entwurf prüfen' : 'Review draft'}</Button></div>}
    {recovery.storageFailed && !notice && <div className="workspace-notice" role="alert"><span>{locale === 'de' ? 'Die automatische Entwurfsicherung ist fehlgeschlagen. Lass die Route geöffnet und speichere oder exportiere sie.' : 'Automatic draft recovery could not be saved. Keep the route open and save or export it.'}</span></div>}
    {!notice && !recovery.storageFailed && (route || waypoints.length > 0) && (recovery.storageConflict || recovery.identityUnavailable) && <div className="workspace-notice" role="status"><span>{recovery.storageConflict ? (locale === 'de' ? 'Ein anderes Fenster hat den Wiederherstellungsentwurf geändert. Dieser Stand wird nicht überschrieben. Speichere oder exportiere deine aktuelle Route.' : 'Another window changed the recovery draft. It will not be overwritten. Save or export your current route.') : (locale === 'de' ? 'Automatische Wiederherstellung ist erst nach Bestätigung deiner Konto- oder Gastidentität verfügbar. Verbinde dich erneut und speichere wichtige Routen zusätzlich.' : 'Automatic recovery requires a confirmed account or guest identity. Reconnect and save important routes separately.')}</span></div>}
    {showGuide && !recovery.pending && <Onboarding onClose={closeGuide} locale={locale} />}
    {notice && <div className="workspace-notice" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label={locale === 'de' ? 'Hinweis schliessen' : 'Dismiss notice'}><X size={17} /></button></div>}

    {route && editing && <WaypointEditor key={route.id} open={waypointEditorOpen} onOpenChange={setWaypointEditorOpen} locale={locale} waypoints={waypoints} selectedId={selectedWaypointId} onSelect={setSelectedWaypointId} busy={isPlanning} notice={notice} onChange={changeEditorPoint} onAdd={addEditorPoint} onRemove={removeWaypoint} onReorder={reorderEditorPoint} />}
    {route && <SupplyPanel supply={supply} locale={locale} open={supplyVisible} onAccept={acceptSupplyStop} canUndo={canUndoStop} onUndo={() => { supply.close(); undoWaypoints() }} onEditStops={() => { supply.close(); startEditing(); openWaypointEditor(route.waypoints.find((point) => point.id.startsWith('supply-'))?.id) }} />}
    {confirmation}
    <footer className="font-credit">Fonts made from <a href="http://www.onlinewebfonts.com" target="_blank" rel="noreferrer">Web Fonts</a> is licensed by CC BY 4.0</footer>
  </main>
}

function PreferenceSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Array<[T, string]> }) {
  return <label className="preference-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>
}
