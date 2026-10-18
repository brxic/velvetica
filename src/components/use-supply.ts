'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Locale, PlannedRoute, RoutePreferences } from '@/lib/domain'
import { plannedRouteSchema } from '@/lib/route-schema'
import { prepareSupplyStop, spliceSupplyStop, supplyResultSchema, type SupplyCategory, type SupplyResult } from '@/lib/supply'
import { routingErrorMessage } from '@/lib/routing/errors'

export function useSupply(route: PlannedRoute | null, preferences: RoutePreferences, locale: Locale) {
  const [open, setOpen] = useState(false), [enabled, setEnabled] = useState(false)
  const [categories, setCategories] = useState<SupplyCategory[]>(['water', 'food', 'shop'])
  const [refresh, setRefresh] = useState(0), [selectedId, setSelectedId] = useState<string | null>(null)
  const [response, setResponse] = useState<{ key: string; result?: SupplyResult; error?: string }>({ key: '' })
  const [preview, setPreview] = useState<{ key: string; value?: ReturnType<typeof spliceSupplyStop>; error?: string; busy?: boolean } | null>(null)
  const quoteController = useRef<AbortController | null>(null)
  const key = useMemo(() => JSON.stringify([route?.id, route?.geometry, route?.waypoints, route?.profile, preferences, locale]), [route?.id, route?.geometry, route?.waypoints, route?.profile, preferences, locale])
  const requestKey = `${key}:${categories.join(',')}:${refresh}`
  const active = Boolean(route && (open || enabled))
  const coordinates = route?.geometry.coordinates
  const result = response.key === requestKey ? response.result : undefined
  const error = response.key === requestKey ? response.error : undefined
  const selected = result?.pois.find((poi) => poi.id === selectedId)
  const quote = preview?.key === key ? preview : null

  useEffect(() => {
    if (!active || !coordinates) return
    const controller = new AbortController()
    void fetch('/api/pois/nearby', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coordinates, categories }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(9_000)]), cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error('SUPPLY_UNAVAILABLE'); return supplyResultSchema.parse(await r.json()) })
      .then((result) => { if (!controller.signal.aborted) setResponse({ key: requestKey, result }) })
      .catch(() => { if (!controller.signal.aborted) setResponse({ key: requestKey, error: locale === 'de' ? 'Versorgung derzeit nicht verfügbar. Deine Route bleibt unverändert.' : 'Supply search is unavailable. Your route is unchanged.' }) })
    return () => controller.abort()
  }, [active, requestKey, coordinates, categories, locale])
  useEffect(() => () => { quoteController.current?.abort(); quoteController.current = null }, [key])

  function clearPreview() { quoteController.current?.abort(); quoteController.current = null; setPreview(null) }
  function close() { clearPreview(); setOpen(false) }
  function select(id: string | null) { clearPreview(); setSelectedId(id); setOpen(true) }
  async function calculate() {
    if (!route || !selected) return
    clearPreview()
    const controller = new AbortController(); quoteController.current = controller
    setPreview({ key, busy: true })
    try {
      const prepared = prepareSupplyStop(route, selected, locale)
      const r = await fetch('/api/routes/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale, profile: route.profile, mode: 'one-way', targetDistanceKm: 2, waypoints: prepared.legPoints, preferences }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55_000)]) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.code ?? 'ROUTE_FAILED')
      const value = spliceSupplyStop(route, selected, locale, plannedRouteSchema.parse(data), prepared)
      plannedRouteSchema.parse(value.route)
      if (quoteController.current === controller) setPreview({ key, value })
    } catch (e) {
      if (quoteController.current !== controller) return
      const code = e instanceof Error && e.name === 'TimeoutError' ? 'ROUTER_TIMEOUT' : e instanceof TypeError ? 'ROUTER_UNAVAILABLE' : e instanceof Error ? e.message : 'ROUTE_FAILED'
      const message = code.startsWith('STOP_') ? (locale === 'de' ? 'Kein geeigneter Anschluss für diesen Stopp. Wähle einen anderen Ort oder bearbeite die Wegpunkte.' : 'No suitable connection for this stop. Choose another place or edit waypoints.') : routingErrorMessage(code, locale)
      setPreview({ key, error: message })
    } finally { if (quoteController.current === controller) quoteController.current = null }
  }
  return { open, enabled, setEnabled, categories, result, error, selected, quote, loading: active && !result && !error,
    show() { setEnabled(true); setOpen(true) }, close, select, clearPreview, calculate,
    retry() { setRefresh((n) => n + 1) },
    toggleCategory(category: SupplyCategory) { clearPreview(); setSelectedId(null); setCategories((current) => current.includes(category) ? current.length > 1 ? current.filter((c) => c !== category) : current : [...current, category]) },
  }
}
