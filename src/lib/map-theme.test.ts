import { describe, expect, it } from 'vitest'
import type { LayerSpecification } from 'maplibre-gl'
import { darkBasemapPaint, originalBasemapPaint } from './map-theme'
import manifest from '@/app/manifest'

const layers: LayerSpecification[] = [
  { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
  { id: 'water', type: 'fill', source: 'base', 'source-layer': 'water', paint: { 'fill-color': '#abcdef' } },
  { id: 'place_city', type: 'symbol', source: 'base', 'source-layer': 'place', paint: { 'text-color': '#222222' } },
  { id: 'road_fill', type: 'line', source: 'base', 'source-layer': 'transportation', paint: { 'line-color': '#fafafa', 'line-width': 3 } },
  { id: 'pattern_landcover', type: 'fill', source: 'base', 'source-layer': 'landcover', paint: { 'fill-pattern': 'forest' } },
  { id: 'active-route-line', type: 'line', source: 'route', paint: { 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#00ff00', 1, '#ff0000'] } },
]

describe('map presentation', () => {
  it('styles geography and readable labels without modifying routes, patterns or source definitions', () => {
    const original = structuredClone(layers)
    const patches = darkBasemapPaint(layers)
    expect(patches.map(({ id }) => id)).toEqual(['background', 'water', 'place_city', 'road_fill'])
    expect(patches[1].paint['fill-color']).toBe('#203d4c')
    expect(patches[2].paint['text-color']).toBe('#d1d1d6')
    expect(patches[3].paint).not.toHaveProperty('line-width')
    expect(layers).toEqual(original)
  })
  it('restores exact original expressions and unsets properties absent in the light style', () => {
    const light = originalBasemapPaint(layers, darkBasemapPaint(layers))
    expect(light[0].paint['background-color']).toBe('#ffffff')
    expect(light[2].paint).toEqual({ 'text-color': '#222222', 'text-halo-color': null })
    expect(light[3].paint['line-color']).toBe('#fafafa')
  })
  it('uses only the brand name on the installed app splash screen', () => {
    expect(manifest().name).toBe('Velvetia')
    expect(manifest().short_name).toBe('Velvetia')
  })
})
