'use client'

import { ChevronDown, ChevronUp, Map } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import type { Locale } from '@/lib/domain'

/** Shared gesture contract for map workspace sheets; form scrolling never drags. */
export function useMapSheet(active: boolean) {
  const [peek, setPeek] = useState(false)
  const [drag, setDrag] = useState(0)
  const gesture = useRef<{ y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return
    gesture.current = { y: event.clientY, moved: false }
    suppressClick.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = gesture.current
    if (!start) return
    const delta = event.clientY - start.y
    if (Math.abs(delta) > 8) start.moved = true
    setDrag(Math.max(peek ? -160 : -12, Math.min(peek ? 12 : 160, delta)))
  }
  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = gesture.current
    if (!start) return
    const delta = event.clientY - start.y
    suppressClick.current = start.moved
    if (delta > 40) setPeek(true)
    else if (delta < -40) setPeek(false)
    gesture.current = null
    setDrag(0)
  }
  function onPointerCancel() { gesture.current = null; suppressClick.current = false; setDrag(0) }
  function toggle() { setPeek((value) => !value) }
  return { collapsed: active && peek, style: active && drag ? { transform: `translateY(${drag}px)` } : undefined, toggle,
    handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick() { if (suppressClick.current) { suppressClick.current = false; return }; toggle() } },
  }
}

export function MapSheetHeader({ sheet, title, subject, contentId, locale }: { sheet: ReturnType<typeof useMapSheet>; title: string; subject: string; contentId: string; locale: Locale }) {
  const de = locale === 'de'
  return <div className="planner-sheet-head">
    <button type="button" className="planner-sheet-handle" aria-controls={contentId} aria-expanded={!sheet.collapsed} aria-label={de ? `${subject} ${sheet.collapsed ? 'aufklappen' : 'minimieren'}` : `${sheet.collapsed ? 'Expand' : 'Minimise'} ${subject.toLowerCase()}`} {...sheet.handle}>
      <span className="sheet-grip" /><span>{title}</span>{sheet.collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
    </button>
    <button type="button" className="planner-map-button" onClick={sheet.toggle}><Map size={16} />{sheet.collapsed ? (de ? 'Öffnen' : 'Open') : (de ? 'Karte' : 'Map')}</button>
  </div>
}
