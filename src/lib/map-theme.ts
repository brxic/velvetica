import type { LayerSpecification } from 'maplibre-gl'

export type MapTheme = 'light' | 'dark'
export type MapPaintPatch = { id: string; paint: Record<string, unknown> }

/** Change only basemap paint: never reload tiles, route sources or the camera. */
export function darkBasemapPaint(layers: LayerSpecification[]): MapPaintPatch[] {
  return layers.flatMap((layer) => {
    const source = 'source-layer' in layer ? layer['source-layer'] ?? '' : ''
    // Application GeoJSON overlays have no vector source-layer.
    if (layer.type !== 'background' && !source) return []
    const paint: Record<string, unknown> = {}
    const water = /water|glacier/.test(`${source} ${layer.id}`)
    if (layer.type === 'background') paint['background-color'] = '#22282e'
    if (layer.type === 'fill') {
      if (layer.id === 'hillshade_grey') paint['fill-color'] = ['interpolate', ['linear'], ['to-number', ['get', 'luminosity']], -15, '#141b21', 0, '#262d33']
      else if (layer.id === 'hillshade_yellow') paint['fill-color'] = '#667862'
      else if (water) paint['fill-color'] = '#203d4c'
      else if (layer.id === 'hazard') paint['fill-color'] = '#69533d'
      else if (source === 'landcover') paint['fill-color'] = ['match', ['get', 'class'], ['forest', 'wood'], '#244036', ['ice', 'glacier'], '#3a505b', 'sand', '#443f35', '#303e36']
      else if (source === 'landuse') paint['fill-color'] = '#34413b'
      else paint['fill-color'] = '#39434b'
    }
    if (layer.type === 'line') {
      paint['line-color'] = water ? '#3b6073' : source === 'boundary' ? '#74637b' : source === 'contour_line' ? '#5a5144' : /landcover|landuse|park/.test(source) ? '#3c5a48' : '#4c5861'
      if (source === 'transportation') {
        paint['line-color'] = /casing/.test(layer.id) ? '#1c242a' : /public_transport/.test(layer.id) ? '#8e777b' : ['match', ['get', 'class'], ['motorway', 'trunk'], '#a29370', ['primary', 'secondary'], '#828b90', ['path', 'track', 'footway', 'pedestrian'], '#70857c', '#65737e']
      }
    }
    if (layer.type === 'symbol') {
      // Road numbers sit on the provider's light shield sprites, not on land.
      paint['text-color'] = layer.id === 'road_number' ? '#263039' : water ? '#8ab3c9' : source === 'park' ? '#9cbaa3' : '#d1d1d6'
      if (layer.id !== 'road_number') paint['text-halo-color'] = '#22282e'
      if (layer.paint && 'icon-color' in layer.paint) paint['icon-color'] = '#c0c6cc'
      if (layer.paint && 'icon-halo-color' in layer.paint) paint['icon-halo-color'] = '#22282e'
    }
    // Pattern-only fills must retain their original sprite treatment.
    if (layer.type === 'fill' && layer.paint && 'fill-pattern' in layer.paint) return []
    return Object.keys(paint).length ? [{ id: layer.id, paint }] : []
  })
}

export function originalBasemapPaint(layers: LayerSpecification[], patches: MapPaintPatch[]): MapPaintPatch[] {
  const originals = new Map(layers.map((layer) => [layer.id, layer.paint as Record<string, unknown> | undefined]))
  return patches.map(({ id, paint }) => ({ id, paint: Object.fromEntries(Object.keys(paint).map((property) => [property, originals.get(id)?.[property] ?? null])) }))
}
