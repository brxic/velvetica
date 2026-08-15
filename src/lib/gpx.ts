import type { PlannedRoute } from './domain'

const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]!)

export function routeToGpx(route: PlannedRoute) {
  const points = route.geometry.coordinates.map(([lon, lat]) => `      <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"></trkpt>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Velvetia" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata><name>${escapeXml(route.name)}</name><time>${route.createdAt}</time></metadata>
  <trk><name>${escapeXml(route.name)}</name><type>cycling</type><trkseg>
${points}
  </trkseg></trk>
</gpx>`
}

export function downloadGpx(route: PlannedRoute) {
  const blob = new Blob([routeToGpx(route)], { type: 'application/gpx+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `${route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.gpx`; anchor.click()
  URL.revokeObjectURL(url)
}

