'use client'

import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type MapMouseEvent, type Marker } from 'maplibre-gl'
import type { Coordinate, Locale, PlannedRoute, Waypoint } from '@/lib/domain'
import { SWITZERLAND } from '@/lib/domain'

type Props = {
  activeRoute: PlannedRoute | null
  savedRoutes: PlannedRoute[]
  waypoints: Waypoint[]
  onMapClick: (longitude: number, latitude: number) => void
  onWaypointMove: (id: string, longitude: number, latitude: number) => void
  onRouteShape: (longitude: number, latitude: number, insertionIndex: number) => void
  activeProfileIndex: number | null
  locale: Locale
}

const emptyCollection = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] })

export function MapCanvas({ activeRoute, savedRoutes, waypoints, onMapClick, onWaypointMove, onRouteShape, activeProfileIndex, locale }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const clickHandlerRef = useRef(onMapClick)
  const moveHandlerRef = useRef(onWaypointMove)
  const shapeHandlerRef = useRef(onRouteShape)
  const activeRouteRef = useRef(activeRoute)
  const waypointsRef = useRef(waypoints)

  useEffect(() => { clickHandlerRef.current = onMapClick }, [onMapClick])
  useEffect(() => { moveHandlerRef.current = onWaypointMove }, [onWaypointMove])
  useEffect(() => { shapeHandlerRef.current = onRouteShape }, [onRouteShape])
  useEffect(() => { activeRouteRef.current = activeRoute }, [activeRoute])
  useEffect(() => { waypointsRef.current = waypoints }, [waypoints])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SWITZERLAND.mapStyle,
      center: SWITZERLAND.center,
      zoom: SWITZERLAND.defaultZoom,
      attributionControl: false,
      maxBounds: [[4.8, 44.8], [11.8, 48.5]],
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
      if (!route) return
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
      map.addSource('active-route', { type: 'geojson', data: emptyCollection() })
      map.addLayer({ id: 'active-route-casing', type: 'line', source: 'active-route', paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': .88 } })
      map.addLayer({ id: 'active-route-line', type: 'line', source: 'active-route', paint: { 'line-color': '#e00112', 'line-width': 5, 'line-opacity': 1 } })
      map.addSource('profile-position', { type: 'geojson', data: emptyCollection() })
      map.addLayer({ id: 'profile-position-dot', type: 'circle', source: 'profile-position', paint: { 'circle-radius': 7, 'circle-color': '#e00112', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } })
      map.on('mouseenter', 'active-route-line', () => { map.getCanvas().style.cursor = 'grab' })
      map.on('mouseleave', 'active-route-line', () => { if (!dragMarker) map.getCanvas().style.cursor = '' })
      map.on('mousedown', 'active-route-line', beginRouteDrag)
      map.on('click', 'active-route-line', (event) => {
        if (suppressNextClick) return
        const route = activeRouteRef.current
        if (!route) return
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
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => {
      const activeSource = map.getSource('active-route') as GeoJSONSource | undefined
      activeSource?.setData(activeRoute ? { type: 'Feature', properties: {}, geometry: activeRoute.geometry } : emptyCollection())
      const savedSource = map.getSource('saved-routes') as GeoJSONSource | undefined
      savedSource?.setData({ type: 'FeatureCollection', features: savedRoutes.filter((route) => route.id !== activeRoute?.id).map((route) => ({ type: 'Feature', properties: { id: route.id }, geometry: route.geometry })) })
      if (activeRoute) {
        const coordinates = activeRoute.geometry.coordinates
        const bounds = coordinates.reduce((box, coordinate) => box.extend(coordinate as [number, number]), new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]))
        const padding = window.innerWidth <= 900
          ? { top: 90, right: 30, bottom: 360, left: 30 }
          : { top: 100, right: 70, bottom: 180, left: 440 }
        map.fitBounds(bounds, { padding, duration: 800, maxZoom: 13 })
      }
    }
    if (map.loaded()) update(); else map.once('load', update)
  }, [activeRoute, savedRoutes])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => {
      const source = map.getSource('profile-position') as GeoJSONSource | undefined
      const coordinates = activeRoute?.geometry.coordinates
      const profileLength = activeRoute?.metrics.elevationProfile.length ?? 0
      if (!source || activeProfileIndex === null || !coordinates?.length || !profileLength) {
        source?.setData(emptyCollection())
        return
      }
      const ratio = activeProfileIndex / Math.max(1, profileLength - 1)
      const coordinate = coordinates[Math.round(ratio * (coordinates.length - 1))]
      source.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: coordinate } })
    }
    if (map.loaded()) update(); else map.once('load', update)
  }, [activeProfileIndex, activeRoute])

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
      const marker = new maplibregl.Marker({ element, anchor: 'center', draggable: true }).setLngLat(waypoint.coordinate).addTo(map)
      marker.on('dragend', () => {
        const position = marker.getLngLat()
        moveHandlerRef.current(waypoint.id, position.lng, position.lat)
      })
      return marker
    })
  }, [waypoints])

  return <div ref={containerRef} className="map-canvas" aria-label={locale === 'de' ? 'Interaktive Karte der Schweiz' : 'Interactive map of Switzerland'} />
}
