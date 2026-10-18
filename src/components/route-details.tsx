import { Bike, Clock3, Mountain, Route as RouteIcon } from 'lucide-react'
import type { Locale, PlannedRoute } from '@/lib/domain'
import { t } from '@/lib/i18n'
import { ElevationProfile } from './elevation-profile'
import { RouteProvenance } from './route-provenance'

type Props = { route: PlannedRoute; locale: Locale; speedKmh: number | null; activeIndex: number | null; onActiveIndexChange: (index: number | null) => void; condensed?: boolean }
const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} h`

export function RouteDetails({ route, locale, speedKmh, activeIndex, onActiveIndexChange, condensed = false }: Props) {
  const copy = t(locale)
  const isGpxImport = route.provenance.routingEngine === 'GPX Import'
  const hasSurfaceAnalysis = route.metrics.surfaceAnalyzed ?? (route.provenance.routingEngine.startsWith('Valhalla') && route.provenance.confidence === 'high')
  return <div className={`route-details ${condensed ? 'is-condensed' : ''}`}><div className="metric-grid">
        <div><RouteIcon /><span>{copy.distanceLabel}</span><strong>{route.metrics.distanceKm} km</strong></div>
        <div><Clock3 /><span>{copy.time}{speedKmh ? ` · ${speedKmh} km/h` : ''}</span><strong>{formatDuration(speedKmh ? Math.round(route.metrics.distanceKm / speedKmh * 60) : route.metrics.durationMinutes)}</strong></div>
        <div><Mountain /><span>{copy.elevation}</span><strong>{route.metrics.elevationAnalyzed !== false && route.metrics.elevationProfile.length > 1 ? `${route.metrics.elevationGainM} m` : '—'}</strong></div>
        <div><Bike /><span>{copy.surface}</span><strong>{hasSurfaceAnalysis ? `${route.metrics.asphaltPercent} %` : '—'}</strong></div>
      </div>
      <div className="route-detail-grid">
        <ElevationProfile route={route} locale={locale} activeIndex={activeIndex} onActiveIndexChange={onActiveIndexChange} />
        {!condensed && <div className="surface-card">{!hasSurfaceAnalysis ? <div><span>{locale === 'de' ? 'Untergrund' : 'Surface'}</span><strong>{locale === 'de' ? 'Nicht analysiert' : 'Not analysed'}</strong></div> : <><div><span>{locale === 'de' ? 'Untergrund' : 'Surface'}</span><strong>{route.metrics.asphaltPercent}% {locale === 'de' ? 'befestigt' : 'paved'}</strong></div><div className="surface-track"><i style={{ width: `${route.metrics.asphaltPercent}%` }} /></div><small>{route.metrics.cyclewayPercent}% {locale === 'de' ? 'geschätzter Radweganteil' : 'estimated cycleway share'}</small></>}</div>}
      </div>
      {!condensed && <>
      {route.warnings.length > 0 && <ul className="warning-list">{route.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <RouteProvenance provenance={route.provenance} locale={locale} />
      <p className="preview-note">{isGpxImport ? (locale === 'de' ? 'Der Verlauf stammt aus der GPX-Datei und wurde nicht neu berechnet.' : 'The route comes from the GPX file and has not been recalculated.') : route.provenance.routingEngine === 'FOSSGIS OSRM Bike' ? (locale === 'de' ? 'Mit dem öffentlichen FOSSGIS-Fahrradrouter auf OSM-Wegen berechnet. Sperrungen und Beschilderung vor Ort beachten.' : 'Calculated on OSM paths using the public FOSSGIS bicycle router. Check closures and signs along the route.') : route.metrics.confidence === 'verified' ? (locale === 'de' ? 'Mit Valhalla auf OSM-Wegen berechnet. Sperrungen und Beschilderung vor Ort beachten.' : 'Calculated on OSM paths using Valhalla. Check closures and signs along the route.') : copy.previewInfo}</p>
      </>}
      </div>
}
