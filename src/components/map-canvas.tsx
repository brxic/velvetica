'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, Marker } from 'maplibre-gl'
import type { Coordinate, Locale, PlannedRoute, Waypoint } from '@/lib/domain'
import { SWITZERLAND } from '@/lib/domain'
import { analyzeRoute, gradeGradientStops } from '@/lib/route-analysis'
import { mapInsets } from '@/lib/map-layout'

type Props = {
  activeRoute: PlannedRoute | null
  savedRoutes: PlannedRoute[]
  waypoints: Waypoint[]
  onMapClick: (longitude: number, latitude: number) => void
  onWaypointMove: (id: string, longitude: number, latitude: number) => void
  onRouteShape: (longitude: number, latitude: number, insertionIndex: number) => void
  activeProfileIndex: number | null
  onActiveProfileIndexChange: (index: number | null) => void
  locale: Locale
  readOnly?: boolean
}

const emptyCollection = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] })

export function MapCanvas({ activeRoute, savedRoutes, waypoints, onMapClick, onWaypointMove, onRouteShape, activeProfileIndex, onActiveProfileIndexChange, locale, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const fittedGeometryRef = useRef<PlannedRoute['geometry'] | null>(null)
  const layoutUpdateRef = useRef<() => void>(() => {})
  const markersRef = useRef<Marker[]>([])
  const clickHandlerRef = useRef(onMapClick)
  const moveHandlerRef = useRef(onWaypointMove)
  const shapeHandlerRef = useRef(onRouteShape)
  const activeRouteRef = useRef(activeRoute)
  const waypointsRef = useRef(waypoints)
  const profileHandlerRef = useRef(onActiveProfileIndexChange)
  const geometry = activeRoute?.geometry, metrics = activeRoute?.metrics, provenance = activeRoute?.provenance
  const analysis = useMemo(() => {
    const result = geometry && metrics && provenance ? analyzeRoute({ geometry, metrics, provenance }) : { samples: [], climbs: [] }
    return { ...result, coordinates: result.samples.map((sample) => sample.coordinate) }
  }, [geometry, metrics, provenance])
  const analysisRef = useRef(analysis)
  useEffect(() => { analysisRef.current = analysis }, [analysis])

  useEffect(() => { clickHandlerRef.current = onMapClick }, [onMapClick])
  useEffect(() => { moveHandlerRef.current = onWaypointMove }, [onWaypointMove])
  useEffect(() => { shapeHandlerRef.current = onRouteShape }, [onRouteShape])
  useEffect(() => { activeRouteRef.current = activeRoute }, [activeRoute])
  useEffect(() => { waypointsRef.current = waypoints }, [waypoints])
  useEffect(() => { profileHandlerRef.current = onActiveProfileIndexChange }, [onActiveProfileIndexChange])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    maplibregl.setWorkerUrl(new URL('/maplibre/maplibre-gl-worker.mjs', window.location.origin).href)
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SWITZERLAND.mapStyle,
      center: SWITZERLAND.center,
      zoom: SWITZERLAND.defaultZoom,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: SWITZERLAND.attribution }), 'bottom-right')
    let suppressNextClick = false
    let dragMarker: Marker | null = null
    let insertionIndex = 1
    const nearestCoordinateIndex = (coordinates: Coordinate[], longitude: number, latitude: number) => {
      let nearest = 0; let nearestDistance = Number.POSITIVE_INFINITY
      coordinates.forEach((coordinate, index) => {
        const distance = (coordinate[0] - longitude) ** 2 + (coordinate[1] - latitude) ** 2
        if (distance < nearestDistance) { nearest = index; nearestDistance = distance }
      })
      return nearest
    }
    const routeInsertionIndex = (routeIndex: number, coordinates: Coordinate[]) => {
      const points = waypointsRef.current
      for (let index = 1; index < points.length; index++) {
        const point = points[index]
        const pointIndex = point.kind === 'end' ? coordinates.length - 1 : nearestCoordinateIndex(coordinates, point.coordinate[0], point.coordinate[1])
        if (pointIndex > routeIndex) return index
      }
      return points.length
    }
    const finishRouteDrag = (event: MapMouseEvent) => {
      if (!dragMarker) return
      const position = event.lngLat
      dragMarker.remove(); dragMarker = null
      map.dragPan.enable(); map.getCanvas().style.cursor = ''
      suppressNextClick = true
      shapeHandlerRef.current(position.lng, position.lat, insertionIndex)
      window.setTimeout(() => { suppressNextClick = false }, 0)
      map.off('mousemove', moveRouteDrag); map.off('mouseup', finishRouteDrag)
    }
    const moveRouteDrag = (event: MapMouseEvent) => dragMarker?.setLngLat(event.lngLat)
    const beginRouteDrag = (event: MapMouseEvent) => {
      const route = activeRouteRef.current
      if (!route || readOnly) return
      event.preventDefault()
      const coordinates = route.geometry.coordinates as Coordinate[]
      const routeIndex = nearestCoordinateIndex(coordinates, event.lngLat.lng, event.lngLat.lat)
      insertionIndex = routeInsertionIndex(routeIndex, coordinates)
      const element = document.createElement('div'); element.className = 'route-drag-marker'
      dragMarker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(event.lngLat).addTo(map)
      map.dragPan.disable(); map.getCanvas().style.cursor = 'grabbing'
      map.on('mousemove', moveRouteDrag); map.on('mouseup', finishRouteDrag)
    }
    map.on('load', () => {
      map.addSource('saved-routes', { type: 'geojson', data: emptyCollection() })
      map.addLayer({ id: 'saved-routes-line', type: 'line', source: 'saved-routes', paint: { 'line-color': '#676a70', 'line-width': 3, 'line-opacity': .42, 'line-dasharray': [2, 2] } })
      map.addSource('active-route', { type: 'geojson', data: emptyCollection(), lineMetrics: true })
      map.addLayer({ id: 'active-route-casing', type: 'line', source: 'active-route', paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': .88 } })
      map.addLayer({ id: 'active-route-line', type: 'line', source: 'active-route', paint: { 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#e00112', 1, '#e00112'], 'line-width': 5, 'line-opacity': 1 } })
      map.addSource('profile-position', { type: 'geojson', data: emptyCollection() })
      map.addLayer({ id: 'profile-position-dot', type: 'circle', source: 'profile-position', paint: { 'circle-radius': 7, 'circle-color': '#e00112', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } })
      map.on('mouseenter', 'active-route-line', () => { map.getCanvas().style.cursor = readOnly ? 'crosshair' : 'grab' })
      map.on('mousemove', 'active-route-line', (event) => {
        const route = activeRouteRef.current
        if (route) {
          const samples = analysisRef.current.samples
          const sampleIndex = nearestCoordinateIndex(analysisRef.current.coordinates, event.lngLat.lng, event.lngLat.lat)
          profileHandlerRef.current(samples.length > 1 ? sampleIndex : null)
        }
      })
      map.on('mouseleave', 'active-route-line', () => { if (!dragMarker) map.getCanvas().style.cursor = ''; profileHandlerRef.current(null) })
      map.on('mousedown', 'active-route-line', beginRouteDrag)
      map.on('click', 'active-route-line', (event) => {
        if (suppressNextClick) return
        const route = activeRouteRef.current
        if (!route || readOnly) return
        const coordinates = route.geometry.coordinates as Coordinate[]
        const routeIndex = nearestCoordinateIndex(coordinates, event.lngLat.lng, event.lngLat.lat)
        suppressNextClick = true
        event.preventDefault()
        shapeHandlerRef.current(event.lngLat.lng, event.lngLat.lat, routeInsertionIndex(routeIndex, coordinates))
        window.setTimeout(() => { suppressNextClick = false }, 0)
      })
      map.on('click', (event) => { if (!suppressNextClick) clickHandlerRef.current(event.lngLat.lng, event.lngLat.lat) })
    })
    mapRef.current = map
    return () => { dragMarker?.remove(); map.remove(); mapRef.current = null }
  }, [readOnly])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => {
      const activeSource = map.getSource('active-route') as GeoJSONSource | undefined
      if (activeRoute) {
        activeSource?.setData({ type: 'Feature', properties: {}, geometry: activeRoute.geometry })
        map.setPaintProperty('active-route-line', 'line-gradient', ['interpolate', ['linear'], ['line-progress'], ...gradeGradientStops(analysis)])
      } else activeSource?.setData(emptyCollection())
      const savedSource = map.getSource('saved-routes') as GeoJSONSource | undefined
      savedSource?.setData({ type: 'FeatureCollection', features: savedRoutes.filter((route) => route.id !== activeRoute?.id).map((route) => ({ type: 'Feature', properties: { id: route.id }, geometry: route.geometry })) })
      layoutUpdateRef.current()
    }
    if (map.getSource('active-route')) update(); else map.once('load', update)
    return () => { map.off('load', update) }
  }, [activeRoute, savedRoutes, readOnly, analysis])

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    const workspace = container?.parentElement
    if (!map || !container || !workspace) return
    let frame = 0
    let previousLayout = ''
    let previousOffset: [number, number] = [0, 0]
    let mobileAttributionInitialized = false
    const observed = new WeakSet<Element>()
    const observer = new ResizeObserver(() => schedule())
    const update = () => {
      if (window.innerWidth <= 900 && !mobileAttributionInitialized) {
        const attribution = container.querySelector<HTMLDetailsElement>('.maplibregl-ctrl-attrib')
        if (attribution?.classList.contains('maplibregl-compact')) {
          // Keep the standard attribution control available, initially compact on
          // phones so its expanded text does not cover the editing controls.
          attribution.classList.remove('maplibregl-compact-show')
          attribution.removeAttribute('open')
          mobileAttributionInitialized = true
        }
      }
      const panels = [...workspace.querySelectorAll<HTMLElement>('.planner-panel, .route-summary, .shared-summary')]
      const header = workspace.querySelector<HTMLElement>('.topbar')
      for (const element of [...panels, ...(header ? [header] : [])]) if (!observed.has(element)) { observed.add(element); observer.observe(element) }
      const padding = mapInsets(container.clientWidth, container.clientHeight, header?.getBoundingClientRect() ?? null, panels.map((panel) => panel.getBoundingClientRect()))
      const layout = JSON.stringify(padding)
      const offset: [number, number] = [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2]
      if (layout !== previousLayout) {
        container.style.setProperty('--map-safe-bottom', `${padding.bottom}px`)
        container.style.setProperty('--map-safe-right', `${padding.right}px`)
        map.resize()
      }
      const route = activeRouteRef.current
      if (route && map.getLayer('active-route-line') && (layout !== previousLayout || fittedGeometryRef.current !== route.geometry)) {
        const coordinates = route.geometry.coordinates
        const bounds = coordinates.reduce((box, coordinate) => box.extend(coordinate as [number, number]), new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]))
        map.fitBounds(bounds, { padding, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250, maxZoom: 13 })
        fittedGeometryRef.current = route.geometry
      } else if (!route) {
        fittedGeometryRef.current = null
        // Keep the chosen region in the visible map area, not beneath the sheet.
        if (layout !== previousLayout) {
          const center = map.unproject([container.clientWidth / 2 + previousOffset[0], container.clientHeight / 2 + previousOffset[1]])
          map.easeTo({ center, offset, duration: 0 })
        }
      }
      previousOffset = offset
      previousLayout = layout
    }
    function schedule() { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(update) }
    function loaded() { previousLayout = ''; schedule() }
    layoutUpdateRef.current = schedule
    const mutations = new MutationObserver(schedule)
    mutations.observe(workspace, { childList: true, attributes: true, attributeFilter: ['class'] })
    observer.observe(container)
    map.on('load', loaded)
    map.on('idle', schedule)
    schedule()
    return () => { layoutUpdateRef.current = () => {}; observer.disconnect(); mutations.disconnect(); map.off('load', loaded); map.off('idle', schedule); window.cancelAnimationFrame(frame) }
  }, [readOnly])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => {
      const source = map.getSource('profile-position') as GeoJSONSource | undefined
      const samples = analysis.samples
      if (!source || activeProfileIndex === null || !samples.length) {
        source?.setData(emptyCollection())
        return
      }
      const coordinate = samples[Math.max(0, Math.min(samples.length - 1, activeProfileIndex))].coordinate
      source.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: coordinate } })
    }
    if (map.getSource('profile-position')) update(); else map.once('load', update)
  }, [activeProfileIndex, analysis])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = waypoints.filter((waypoint) => waypoint.kind !== 'generated').map((waypoint, index) => {
      const element = document.createElement('button')
      element.className = `map-marker map-marker--${waypoint.kind}`
      element.type = 'button'; element.title = waypoint.label
      element.setAttribute('aria-label', waypoint.label)
      element.textContent = waypoint.kind === 'start' ? 'A' : waypoint.kind === 'end' ? 'B' : waypoint.kind === 'shaping' ? '•' : String(index + 1)
      const marker = new maplibregl.Marker({ element, anchor: 'center', draggable: !readOnly }).setLngLat(waypoint.coordinate).addTo(map)
      marker.on('dragend', () => {
        const position = marker.getLngLat()
        moveHandlerRef.current(waypoint.id, position.lng, position.lat)
      })
      return marker
    })
  }, [waypoints, readOnly])

  return <div ref={containerRef} className="map-canvas" aria-label={locale === 'de' ? 'Interaktive Karte der Schweiz' : 'Interactive map of Switzerland'} />
}
