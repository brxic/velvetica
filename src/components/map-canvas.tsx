'use client'

import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from 'maplibre-gl'
import type { Locale, PlannedRoute, Waypoint } from '@/lib/domain'
import { SWITZERLAND } from '@/lib/domain'

type Props = {
  activeRoute: PlannedRoute | null
  savedRoutes: PlannedRoute[]
  waypoints: Waypoint[]
  onMapClick: (longitude: number, latitude: number) => void
  onWaypointMove: (id: string, longitude: number, latitude: number) => void
  locale: Locale
}

const emptyCollection = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] })

export function MapCanvas({ activeRoute, savedRoutes, waypoints, onMapClick, onWaypointMove, locale }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const clickHandlerRef = useRef(onMapClick)
  const moveHandlerRef = useRef(onWaypointMove)

  useEffect(() => { clickHandlerRef.current = onMapClick }, [onMapClick])
  useEffect(() => { moveHandlerRef.current = onWaypointMove }, [onWaypointMove])

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
    map.on('click', (event) => clickHandlerRef.current(event.lngLat.lng, event.lngLat.lat))
    map.on('load', () => {
      map.addSource('saved-routes', { type: 'geojson', data: emptyCollection() })
      map.addLayer({ id: 'saved-routes-line', type: 'line', source: 'saved-routes', paint: { 'line-color': '#676a70', 'line-width': 3, 'line-opacity': .42, 'line-dasharray': [2, 2] } })
      map.addSource('active-route', { type: 'geojson', data: emptyCollection() })
      map.addLayer({ id: 'active-route-casing', type: 'line', source: 'active-route', paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': .88 } })
      map.addLayer({ id: 'active-route-line', type: 'line', source: 'active-route', paint: { 'line-color': '#e00112', 'line-width': 5, 'line-opacity': 1 } })
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
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
        map.fitBounds(bounds, { padding: { top: 100, right: 70, bottom: 180, left: 440 }, duration: 800, maxZoom: 13 })
      }
    }
    if (map.loaded()) update(); else map.once('load', update)
  }, [activeRoute, savedRoutes])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = waypoints.map((waypoint, index) => {
      const element = document.createElement('button')
      element.className = `map-marker map-marker--${waypoint.kind}`
      element.type = 'button'; element.title = waypoint.label
      element.setAttribute('aria-label', waypoint.label)
      element.textContent = waypoint.kind === 'start' ? 'A' : waypoint.kind === 'end' ? 'B' : String(index + 1)
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
