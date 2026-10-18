import { CalendarClock, Database, ShieldCheck } from 'lucide-react'
import type { Locale, RouteProvenance as Provenance } from '@/lib/domain'

export function RouteProvenance({ provenance, locale }: { provenance?: Provenance; locale: Locale }) {
  if (!provenance) return <div className="provenance-legacy">{locale === 'de' ? 'Für diese ältere lokale Route sind keine Quelldaten gespeichert.' : 'No source metadata is stored for this older local route.'}</div>
  const confidence = {
    low: locale === 'de' ? 'Niedrig' : 'Low',
    medium: locale === 'de' ? 'Mittel' : 'Medium',
    high: locale === 'de' ? 'Hoch' : 'High',
  }[provenance.confidence]
  const formatDate = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(locale === 'de' ? 'de-CH' : 'en-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : locale === 'de' ? 'Nicht bekannt' : 'Unknown'
  // Earlier versions used the query/import time as source freshness. Those
  // providers do not expose a source date; do not repeat that legacy claim.
  const hasSourceDate = provenance.routingEngine !== 'FOSSGIS OSRM Bike' && provenance.routingEngine !== 'GPX Import' && (!provenance.routingEngine.startsWith('Valhalla') || /^\d{9,}$/.test(provenance.graphVersion))
  const updated = formatDate(hasSourceDate ? provenance.dataUpdatedAt : null)

  return <div className="provenance-card" aria-label={locale === 'de' ? 'Datenquellen und Konfidenz' : 'Data sources and confidence'}>
    <div><Database size={15} /><span>{locale === 'de' ? 'Quelle' : 'Source'}</span><strong>{provenance.primaryDataSource}</strong></div>
    <div><CalendarClock size={15} /><span>{locale === 'de' ? 'Datenstand' : 'Data updated'}</span><strong>{updated}</strong></div>
    <div><CalendarClock size={15} /><span>{locale === 'de' ? 'Ausgewertet' : 'Analysed'}</span><strong>{formatDate(provenance.analyzedAt)}</strong></div>
    <div><ShieldCheck size={15} /><span>{locale === 'de' ? 'Datenkonfidenz' : 'Data confidence'}</span><strong className={`confidence-${provenance.confidence}`}>{confidence}</strong></div>
  </div>
}
