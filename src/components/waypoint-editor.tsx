'use client'

import { ArrowDown, ArrowUp, MapPin, Trash2, X } from 'lucide-react'
import type { Coordinate, Locale, Waypoint } from '@/lib/domain'
import { AppDialog } from './ui/dialog'
import { Button } from './ui/button'
import { PlaceSearch } from './place-search'

type Props = {
  open: boolean; onOpenChange: (open: boolean) => void; locale: Locale; waypoints: Waypoint[]; selectedId: string | null; onSelect: (id: string) => void; busy: boolean; notice: string | null
  onChange: (id: string, place: { label: string; coordinate: Coordinate }) => Promise<boolean>
  onAdd: (place: { label: string; coordinate: Coordinate }) => Promise<boolean>
  onRemove: (id: string) => void; onReorder: (id: string, direction: -1 | 1) => void
}

export function WaypointEditor({ open, onOpenChange, locale, waypoints, selectedId, onSelect, busy, notice, onChange, onAdd, onRemove, onReorder }: Props) {
  const de = locale === 'de'
  const visible = waypoints.filter((point) => point.kind !== 'generated')
  const selected = visible.find((point) => point.id === selectedId)
  const movable = visible.filter((point) => point.kind !== 'start' && point.kind !== 'end')
  const position = movable.findIndex((point) => point.id === selectedId)
  return <AppDialog open={open} onOpenChange={onOpenChange} label={de ? 'Wegpunkte bearbeiten' : 'Edit waypoints'} className="waypoint-dialog" placement="sheet" finalFocus={() => document.querySelector<HTMLButtonElement>('.edit-waypoints-button') ?? true}>
    <div className="dialog-heading"><div><h2>{de ? 'Wegpunkte' : 'Waypoints'}</h2><p className="editor-explanation">{de ? 'Wähle einen Punkt, um seinen Ort zu ändern. Start und Ziel bleiben erhalten.' : 'Choose a point to change its location. Start and destination are kept.'}</p></div><Button variant="icon" onClick={() => onOpenChange(false)} aria-label={de ? 'Schliessen' : 'Close'}><X size={18} /></Button></div>
    <div className="waypoint-editor-list" aria-label={de ? 'Punkte deiner Route' : 'Route points'}>{visible.map((point, index) => <button key={point.id} type="button" aria-pressed={selectedId === point.id} onClick={() => onSelect(point.id)}><span className="waypoint-letter">{point.kind === 'start' ? 'A' : point.kind === 'end' ? 'B' : index + 1}</span><span>{point.label}</span></button>)}</div>
    {selected && <section className="waypoint-edit-fields" aria-label={de ? 'Gewählten Punkt ändern' : 'Change selected point'}>
      <h3>{selected.kind === 'start' ? (de ? 'Start verschieben' : 'Move start') : selected.kind === 'end' ? (de ? 'Ziel verschieben' : 'Move destination') : (de ? 'Zwischenpunkt ändern' : 'Change waypoint')}</h3>
      <fieldset disabled={busy}><PlaceSearch kind={selected.kind === 'start' ? 'start' : selected.kind === 'end' ? 'end' : 'via'} locale={locale} value={selected.label} onSelect={(place) => onChange(selected.id, place)} />
      {position >= 0 && <div className="waypoint-edit-actions"><Button disabled={position === 0} onClick={() => onReorder(selected.id, -1)}><ArrowUp size={16} />{de ? 'Früher' : 'Earlier'}</Button><Button disabled={position === movable.length - 1} onClick={() => onReorder(selected.id, 1)}><ArrowDown size={16} />{de ? 'Später' : 'Later'}</Button><Button variant="icon" onClick={() => onRemove(selected.id)} aria-label={de ? 'Zwischenpunkt entfernen' : 'Remove waypoint'}><Trash2 size={17} /></Button></div>}
      </fieldset>
    </section>}
    <section className="waypoint-edit-fields"><h3><MapPin size={16} />{de ? 'Zwischenpunkt hinzufügen' : 'Add waypoint'}</h3><fieldset disabled={busy || waypoints.length >= 20}><PlaceSearch key={waypoints.length} kind="via" locale={locale} label={de ? 'Neuen Zwischenpunkt suchen' : 'Search new waypoint'} onSelect={onAdd} /></fieldset>{waypoints.length >= 20 && <p className="editor-explanation">{de ? 'Die Route hat die Grenze von 20 Punkten erreicht.' : 'This route has reached its limit of 20 points.'}</p>}</section>
    <p className="editor-explanation" role="status">{busy ? (de ? 'Route wird neu berechnet …' : 'Recalculating route …') : notice ?? (de ? 'Änderungen werden neu berechnet. Speichere die Route anschliessend.' : 'Changes recalculate the route. Save it when you finish.')}</p>
  </AppDialog>
}
