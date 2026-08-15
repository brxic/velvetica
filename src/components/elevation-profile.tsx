import type { PointerEvent } from 'react'
import type { Locale, RouteMetrics } from '@/lib/domain'

type Props = {
  metrics: RouteMetrics
  locale: Locale
  activeIndex: number | null
  onActiveIndexChange: (index: number | null) => void
}

export function ElevationProfile({ metrics, locale, activeIndex, onActiveIndexChange }: Props) {
  const samples = metrics.elevationProfile ?? []
  if (samples.length < 2) return <div className="profile-empty">{locale === 'de' ? 'Höhendaten werden mit dem Routinggraph ergänzt.' : 'Elevation data is added from the routing graph.'}</div>
  const min = Math.min(...samples); const max = Math.max(...samples); const range = Math.max(1, max - min)
  const points = samples.map((value, index) => `${index / (samples.length - 1) * 100},${42 - (value - min) / range * 35}`).join(' ')
  const selected = activeIndex === null ? null : Math.max(0, Math.min(samples.length - 1, activeIndex))
  const selectedX = selected === null ? 0 : selected / (samples.length - 1) * 100
  const selectedY = selected === null ? 0 : 42 - (samples[selected] - min) / range * 35
  const selectedKm = selected === null ? 0 : selected / (samples.length - 1) * metrics.distanceKm

  function selectFromPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    onActiveIndexChange(Math.round(ratio * (samples.length - 1)))
  }

  function moveSelection(direction: number) {
    onActiveIndexChange(Math.max(0, Math.min(samples.length - 1, (selected ?? 0) + direction)))
  }

  return <div className="elevation-card">
    <div className="elevation-head"><span>{locale === 'de' ? 'Höhenprofil' : 'Elevation profile'}</span><small>{selected === null ? `${min}–${max} m` : `${selectedKm.toFixed(1)} km · ${samples[selected]} m`}</small></div>
    <svg viewBox="0 0 100 46" preserveAspectRatio="none" role="slider" tabIndex={0} aria-valuemin={0} aria-valuemax={samples.length - 1} aria-valuenow={selected ?? 0} aria-valuetext={selected === null ? undefined : `${selectedKm.toFixed(1)} km, ${samples[selected]} m`} aria-label={locale === 'de' ? `Höhenprofil von ${min} bis ${max} Metern` : `Elevation profile from ${min} to ${max} metres`} onPointerMove={selectFromPointer} onPointerDown={selectFromPointer} onPointerLeave={() => onActiveIndexChange(null)} onBlur={() => onActiveIndexChange(null)} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); moveSelection(-1) } else if (event.key === 'ArrowRight') { event.preventDefault(); moveSelection(1) } }}>
      <defs><linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e00112" stopOpacity=".28"/><stop offset="1" stopColor="#e00112" stopOpacity=".02"/></linearGradient></defs>
      <polygon points={`0,46 ${points} 100,46`} fill="url(#elevation-fill)" />
      <polyline points={points} fill="none" stroke="#e00112" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {selected !== null ? <><line x1={selectedX} y1="4" x2={selectedX} y2="46" className="elevation-cursor-line" vectorEffect="non-scaling-stroke" /><circle cx={selectedX} cy={selectedY} r="2.4" className="elevation-cursor-dot" vectorEffect="non-scaling-stroke" /></> : null}
    </svg>
  </div>
}
