import { CalendarClock, Database, ShieldCheck } from 'lucide-react'
import type { Locale, RouteProvenance as Provenance } from '@/lib/domain'

export function RouteProvenance({ provenance, locale }: { provenance?: Provenance; locale: Locale }) {
  if (!provenance) return <div className="provenance-legacy">{locale === 'de' ? 'Für diese ältere lokale Route sind keine Quelldaten gespeichert.' : 'No source metadata is stored for this older local route.'}</div>
  const confidence = {
    low: locale === 'de' ? 'Niedrig' : 'Low',
    medium: locale === 'de' ? 'Mittel' : 'Medium',
    high: locale === 'de' ? 'Hoch' : 'High',
  }[provenance.confidence]
  const updated = new Intl.DateTimeFormat(locale === 'de' ? 'de-CH' : 'en-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(provenance.dataUpdatedAt))

  return <div className="provenance-card" aria-label={locale === 'de' ? 'Datenquellen und Konfidenz' : 'Data sources and confidence'}>
    <div><Database size={15} /><span>{locale === 'de' ? 'Quelle' : 'Source'}</span><strong>{provenance.primaryDataSource}</strong></div>
    <div><CalendarClock size={15} /><span>{locale === 'de' ? 'Datenstand' : 'Data updated'}</span><strong>{updated}</strong></div>
    <div><ShieldCheck size={15} /><span>{locale === 'de' ? 'Datenkonfidenz' : 'Data confidence'}</span><strong className={`confidence-${provenance.confidence}`}>{confidence}</strong></div>
  </div>
}
