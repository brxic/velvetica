import type { PlannedRoute } from '@/lib/domain'

export function RouteThumbnail({ route }: { route: PlannedRoute }) {
  const points = route.geometry.coordinates
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1])
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const width = Math.max(...xs) - minX, height = Math.max(...ys) - minY
  const scale = 32 / Math.max(width, height, .00001)
  const stride = Math.max(1, Math.floor(points.length / 150))
  const path = points.filter((_, index) => index % stride === 0 || index === points.length - 1).map(([x, y]) => `${(8 + (32 - width * scale) / 2 + (x - minX) * scale).toFixed(2)},${(8 + (32 - height * scale) / 2 + (minY + height - y) * scale).toFixed(2)}`).join(' ')
  return <svg viewBox="0 0 48 48" aria-hidden="true"><polyline points={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
}
