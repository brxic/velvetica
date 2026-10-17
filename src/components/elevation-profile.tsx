import type { PointerEvent } from 'react'
import { useId, useMemo } from 'react'
import type { Locale, PlannedRoute } from '@/lib/domain'
import { analyzeRoute, nearestSampleIndex } from '@/lib/route-analysis'

type Props = {
  route: PlannedRoute
  locale: Locale
  activeIndex: number | null
  onActiveIndexChange: (index: number | null) => void
}

export function ElevationProfile({ route, locale, activeIndex, onActiveIndexChange }: Props) {
  const { geometry, metrics, provenance } = route
  const analysis = useMemo(() => analyzeRoute({ geometry, metrics, provenance }), [geometry, metrics, provenance])
  const id = useId().replaceAll(':', '')
  const samples = analysis.samples
  if (samples.length < 2) return <div className="profile-empty">{locale === 'de' ? 'Für diese Route sind keine Höhendaten verfügbar.' : 'No elevation data is available for this route.'}</div>
  const elevations = samples.map((sample) => sample.elevationM)
  const min = Math.min(...elevations); const max = Math.max(...elevations); const range = Math.max(1, max - min)
  const total = samples.at(-1)!.distanceKm
  const x = (distance: number) => total > 0 ? distance / total * 100 : 0
  const y = (elevation: number) => 42 - (elevation - min) / range * 35
  const points = samples.map((sample) => `${x(sample.distanceKm)},${y(sample.elevationM)}`).join(' ')
  const selectedIndex = activeIndex === null ? null : Math.max(0, Math.min(samples.length - 1, activeIndex))
  const selected = selectedIndex === null ? null : samples[selectedIndex]

  function selectFromPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)))
    onActiveIndexChange(nearestSampleIndex(samples, ratio * total))
  }

  return <div className="elevation-card">
    <div className="elevation-head"><span>{locale === 'de' ? 'Höhenprofil & Steigung' : 'Elevation & grade'}</span><small>{selected ? `${selected.distanceKm.toFixed(1)} km · ${selected.elevationM} m · ${selected.gradePercent}%` : `${min}–${max} m`}</small></div>
    <svg viewBox="0 0 100 46" preserveAspectRatio="none" role="slider" tabIndex={0} aria-valuemin={0} aria-valuemax={total} aria-valuenow={selected?.distanceKm ?? 0} aria-valuetext={selected ? `${selected.distanceKm.toFixed(1)} km, ${selected.elevationM} m, ${selected.gradePercent}%` : undefined} aria-label={locale === 'de' ? `Höhenprofil von ${min} bis ${max} Metern` : `Elevation profile from ${min} to ${max} metres`} onPointerMove={(event) => { if (event.pointerType !== 'touch' || event.buttons) selectFromPointer(event) }} onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); selectFromPointer(event) }} onPointerLeave={(event) => { if (event.pointerType !== 'touch' && !event.currentTarget.hasPointerCapture?.(event.pointerId)) onActiveIndexChange(null) }} onBlur={() => onActiveIndexChange(null)} onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      onActiveIndexChange(event.key === 'Home' ? 0 : event.key === 'End' ? samples.length - 1 : Math.max(0, Math.min(samples.length - 1, (selectedIndex ?? 0) + (event.key === 'ArrowLeft' ? -1 : 1))))
    }}>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e00112" stopOpacity=".28"/><stop offset="1" stopColor="#e00112" stopOpacity=".02"/></linearGradient><linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">{samples.map((sample) => <stop key={sample.index} offset={`${x(sample.distanceKm)}%`} stopColor={sample.color} />)}</linearGradient></defs>
      <polygon points={`0,46 ${points} 100,46`} fill={`url(#${id}-fill)`} />
      <polyline points={points} fill="none" stroke={`url(#${id}-stroke)`} strokeWidth="2.1" vectorEffect="non-scaling-stroke" />
      {selected ? <><line x1={x(selected.distanceKm)} y1="4" x2={x(selected.distanceKm)} y2="46" className="elevation-cursor-line" vectorEffect="non-scaling-stroke" /><circle cx={x(selected.distanceKm)} cy={y(selected.elevationM)} r="2.4" className="elevation-cursor-dot" vectorEffect="non-scaling-stroke" /></> : null}
    </svg>
    <div className="grade-legend" aria-label={locale === 'de' ? 'Steigungsfarben' : 'Grade colours'}><span><i className="grade-easy" />≤2%</span><span><i style={{ background: '#82b927' }} />2–4%</span><span><i className="grade-medium" />4–6%</span><span><i style={{ background: '#f28c18' }} />6–9%</span><span><i className="grade-hard" />9%+</span></div>
    {analysis.climbs.length ? <div className="climb-list" aria-label={locale === 'de' ? 'Erkannte Anstiege' : 'Detected climbs'}>{analysis.climbs.slice(0, 3).map((climb, index) => <button key={`${climb.startIndex}-${climb.endIndex}`} onClick={() => onActiveIndexChange(nearestSampleIndex(samples, (samples[climb.startIndex].distanceKm + samples[climb.endIndex].distanceKm) / 2))}><b>{locale === 'de' ? `Anstieg ${index + 1}` : `Climb ${index + 1}`}</b><span>{climb.distanceKm} km · +{climb.gainM} m · {climb.averageGradePercent}%</span></button>)}</div> : null}
  </div>
}
