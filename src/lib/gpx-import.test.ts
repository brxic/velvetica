import { describe, expect, it } from 'vitest'
import { GpxImportError, parseGpx } from './gpx-import'

const gpx = (body: string) => `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`

describe('GPX import', () => {
  it('keeps track geometry and derives metrics', () => {
    const route = parseGpx(gpx('<metadata><name>Bern ride</name></metadata><trk><trkseg><trkpt lat="46.948" lon="7.447"><ele>500</ele></trkpt><trkpt lat="46.958" lon="7.457"><ele>530</ele></trkpt></trkseg></trk>'), 'ride.gpx', 'de', 'road')
    expect(route.name).toBe('Bern ride')
    expect(route.geometry.coordinates).toEqual([[7.447, 46.948], [7.457, 46.958]])
    expect(route.metrics.distanceKm).toBeGreaterThan(1)
    expect(route.metrics.elevationGainM).toBe(30)
    expect(route.mode).toBe('one-way')
  })

  it('supports route points and warns about absent elevation', () => {
    const route = parseGpx(gpx('<rte><rtept lat="46.9" lon="7.4"/><rtept lat="46.91" lon="7.41"/></rte>'), 'simple.gpx', 'en', 'city')
    expect(route.name).toBe('simple')
    expect(route.metrics.elevationProfile).toEqual([])
    expect(route.warnings).toContain('The file contains no elevation data.')
  })

  it('rejects XML entities before parsing', () => {
    expect(() => parseGpx('<!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///etc/passwd">]><gpx>&x;</gpx>', 'bad.gpx', 'de', 'road')).toThrowError(GpxImportError)
  })

  it('preserves segment gaps and reports skipped invalid points', () => {
    const route = parseGpx(gpx('<trk><trkseg><trkpt lat="46.9" lon="7.4"/><trkpt lat="999" lon="7.5"/></trkseg><trkseg><trkpt lat="46.91" lon="7.41"/></trkseg></trk>'), 'segments.gpx', 'de', 'gravel')
    expect(route.geometry.coordinates).toHaveLength(2)
    expect(route.warnings.join(' ')).toContain('2 Track-Segmente')
    expect(route.warnings.join(' ')).toContain('1 ungültige Punkte')
  })
})
