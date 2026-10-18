'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from './brand-logo'
import { Download, ArrowUpRight, X } from 'lucide-react'
import type { PlannedRoute } from '@/lib/domain'
import { downloadGpx } from '@/lib/gpx'
import { MapCanvas } from './map-canvas'
import { RouteDetails } from './route-details'
import { Button } from './ui/button'
import { AppDialog } from './ui/dialog'
import { useVisualViewport } from './use-visual-viewport'
import { usePanelBack } from './use-panel-back'

const noop = () => undefined
export function SharedRoute({ route }: { route: PlannedRoute }) {
  useVisualViewport()
  useEffect(() => { document.documentElement.dataset.theme = 'light'; document.documentElement.lang = 'de-CH' }, [])
  const [active, setActive] = useState<number | null>(null)
  const [details, setDetails] = useState(false)
  usePanelBack(details ? 'shared-details' : null, () => setDetails(false))
  return <main className="app-shell theme-light shared-workspace">
    <MapCanvas activeRoute={route} savedRoutes={[]} waypoints={route.waypoints} onMapClick={noop} onWaypointMove={noop} onRouteShape={noop} activeProfileIndex={active} onActiveProfileIndexChange={setActive} locale="de" readOnly />
    <header className="topbar"><Link href="/" className="brand" aria-label="Velvetia Startseite"><BrandLogo /></Link><span className="brand-slogan">Plan less. Ride more.</span><Link href="/" className="text-button">Eigene Tour planen <ArrowUpRight size={17} /></Link></header>
    <section className="shared-summary"><p className="eyebrow">Geteilte Route · Nur ansehen</p><h1>{route.name}</h1>{route.description && <p className="shared-description">{route.description}</p>}<RouteDetails route={route} locale="de" speedKmh={null} activeIndex={active} onActiveIndexChange={setActive} condensed /><div className="shared-actions"><Button variant="primary" onClick={() => downloadGpx(route)}><Download size={17} />GPX herunterladen</Button><Button onClick={() => setDetails(true)}>Alle Details</Button></div></section>
    <AppDialog open={details} onOpenChange={setDetails} label="Alle Routendetails" className="route-detail-dialog" placement="sheet"><div className="dialog-heading"><h2>{route.name}</h2><Button variant="icon" onClick={() => setDetails(false)} aria-label="Schliessen"><X size={18} /></Button></div><RouteDetails route={route} locale="de" speedKmh={null} activeIndex={active} onActiveIndexChange={setActive} /></AppDialog>
  </main>
}
