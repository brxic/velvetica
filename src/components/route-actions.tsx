'use client'

import { Menu } from '@base-ui/react/menu'
import { Copy, Download, Link2, MoreHorizontal, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'
import type { Locale, PlannedRoute } from '@/lib/domain'
import { downloadGpx } from '@/lib/gpx'
import { Button } from './ui/button'
import { RouteShare } from './route-share'

export function RouteActions({ route, locale, saving, saved, canShare, onSave, onReset }: { route: PlannedRoute; locale: Locale; saving: boolean; saved: boolean; canShare: boolean; onSave: (copy?: boolean) => Promise<void>; onReset: () => Promise<void> }) {
  const [shareOpen, setShareOpen] = useState(false)
  const de = locale === 'de'
  return <div className="route-actions">
    <Button variant="primary" busy={saving} onClick={() => void onSave(false)}><Save size={18} />{saving ? (de ? 'Speichert …' : 'Saving …') : saved ? (de ? 'Änderungen speichern' : 'Save changes') : (de ? 'Route speichern' : 'Save route')}</Button>
    <Button onClick={() => downloadGpx(route)}><Download size={18} />{de ? 'GPX exportieren' : 'Export GPX'}</Button>
    <Menu.Root>
      <Menu.Trigger render={<Button className="route-more-button" aria-label={de ? 'Weitere Routenaktionen' : 'More route actions'} />}><MoreHorizontal size={20} /></Menu.Trigger>
      <Menu.Portal><Menu.Positioner className="ui-menu-positioner" side="top" align="end" sideOffset={8}><Menu.Popup className="ui-menu">
        {saved && <Menu.Item className="ui-menu-item" disabled={saving} onClick={() => void onSave(true)}><Copy size={17} />{de ? 'Als Kopie' : 'Save copy'}</Menu.Item>}
        {canShare && <Menu.Item className="ui-menu-item" onClick={() => setShareOpen(true)}><Link2 size={17} />{de ? 'Teilen' : 'Share'}</Menu.Item>}
        <Menu.Item className="ui-menu-item" onClick={() => void onReset()}><RotateCcw size={17} />{de ? 'Neu planen' : 'New route'}</Menu.Item>
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>
    <RouteShare key={route.id} routeId={route.id} locale={locale} open={shareOpen} onOpenChange={setShareOpen} hideTrigger />
  </div>
}
