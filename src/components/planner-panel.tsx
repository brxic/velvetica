'use client'

import type { ReactNode } from 'react'
import type { Locale } from '@/lib/domain'
import { MapSheetHeader, useMapSheet } from './map-sheet'

/** Only the handle owns a drag: scrolling form fields never moves the sheet. */
export function PlannerPanel({ open, compact, locale, children }: { open: boolean; compact: boolean; locale: Locale; children: ReactNode }) {
  const sheet = useMapSheet(compact)
  const de = locale === 'de'
  return <aside id="planner-controls" tabIndex={-1} inert={!open} className={`planner-panel ${open ? 'is-open' : ''} ${sheet.collapsed ? 'is-peek' : ''}`} style={sheet.style} aria-label={de ? 'Routeneinstellungen' : 'Route settings'}>
    <MapSheetHeader sheet={sheet} title={de ? 'Route planen' : 'Plan a route'} subject={de ? 'Planung' : 'Planning'} contentId="planner-scroll" locale={locale} />
    <div className="planner-scroll-frame"><div id="planner-scroll" className="planner-scroll" inert={sheet.collapsed}>{children}</div></div>
  </aside>
}
