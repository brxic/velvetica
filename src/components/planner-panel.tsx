'use client'

import { ChevronDown, ChevronUp, Map } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import type { Locale } from '@/lib/domain'

/** Only the handle owns a drag: scrolling form fields never moves the sheet. */
export function PlannerPanel({ open, compact, locale, children }: { open: boolean; compact: boolean; locale: Locale; children: ReactNode }) {
  const [peek, setPeek] = useState(false)
  const [drag, setDrag] = useState(0)
  const gesture = useRef<{ y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const de = locale === 'de'
  const collapsed = compact && peek
  return <aside id="planner-controls" tabIndex={-1} inert={!open} className={`planner-panel ${open ? 'is-open' : ''} ${collapsed ? 'is-peek' : ''}`} style={compact && drag ? { transform: `translateY(${drag}px)` } : undefined} aria-label={de ? 'Routeneinstellungen' : 'Route settings'}>
    <div className="planner-sheet-head">
      <button type="button" className="planner-sheet-handle" aria-controls="planner-scroll" aria-expanded={!peek} aria-label={peek ? (de ? 'Planung aufklappen' : 'Expand planning') : (de ? 'Planung minimieren' : 'Minimise planning')}
        onPointerDown={(event) => { if (!event.isPrimary || event.button !== 0) return; gesture.current = { y: event.clientY, moved: false }; suppressClick.current = false; event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerMove={(event) => { const start = gesture.current; if (!start) return; const delta = event.clientY - start.y; if (Math.abs(delta) > 8) start.moved = true; setDrag(Math.max(peek ? -160 : -12, Math.min(peek ? 12 : 160, delta))) }}
        onPointerUp={(event) => { const start = gesture.current; if (!start) return; const delta = event.clientY - start.y; suppressClick.current = start.moved; if (delta > 40) setPeek(true); else if (delta < -40) setPeek(false); gesture.current = null; setDrag(0) }}
        onPointerCancel={() => { gesture.current = null; suppressClick.current = false; setDrag(0) }}
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return }; setPeek(!peek) }}>
        <span className="sheet-grip" /><span>{de ? 'Route planen' : 'Plan a route'}</span>{peek ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>
      <button type="button" className="planner-map-button" onClick={() => setPeek(!peek)}><Map size={16} />{peek ? (de ? 'Öffnen' : 'Open') : (de ? 'Karte' : 'Map')}</button>
    </div>
    <div className="planner-scroll-frame"><div id="planner-scroll" className="planner-scroll" inert={collapsed}>{children}</div></div>
  </aside>
}
