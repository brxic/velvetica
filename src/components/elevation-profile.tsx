import type { Locale, RouteMetrics } from '@/lib/domain'

export function ElevationProfile({ metrics, locale }: { metrics: RouteMetrics; locale: Locale }) {
  const samples = metrics.elevationProfile ?? []
  if (samples.length < 2) return <div className="profile-empty">{locale === 'de' ? 'Höhendaten werden mit dem Routinggraph ergänzt.' : 'Elevation data is added from the routing graph.'}</div>
  const min = Math.min(...samples); const max = Math.max(...samples); const range = Math.max(1, max - min)
  const points = samples.map((value, index) => `${index / (samples.length - 1) * 100},${42 - (value - min) / range * 35}`).join(' ')
  return <div className="elevation-card">
    <div className="elevation-head"><span>{locale === 'de' ? 'Höhenprofil' : 'Elevation profile'}</span><small>{min}–{max} m</small></div>
    <svg viewBox="0 0 100 46" preserveAspectRatio="none" role="img" aria-label={locale === 'de' ? `Höhenprofil von ${min} bis ${max} Metern` : `Elevation profile from ${min} to ${max} metres`}>
      <defs><linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e00112" stopOpacity=".28"/><stop offset="1" stopColor="#e00112" stopOpacity=".02"/></linearGradient></defs>
      <polygon points={`0,46 ${points} 100,46`} fill="url(#elevation-fill)" />
      <polyline points={points} fill="none" stroke="#e00112" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
}
