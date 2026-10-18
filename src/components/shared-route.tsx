'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from './brand-logo'
import { Download, ArrowUpRight } from 'lucide-react'
import type { PlannedRoute } from '@/lib/domain'
import { downloadGpx } from '@/lib/gpx'
import { MapCanvas } from './map-canvas'
import { ElevationProfile } from './elevation-profile'

const noop = () => undefined
export function SharedRoute({ route }: { route: PlannedRoute }) {
  useEffect(() => { document.documentElement.dataset.theme = 'light'; document.documentElement.lang = 'de-CH' }, [])
  const [active, setActive] = useState<number | null>(null)
  return <main className="app-shell theme-light shared-workspace">
    <MapCanvas activeRoute={route} savedRoutes={[]} waypoints={route.waypoints} onMapClick={noop} onWaypointMove={noop} onRouteShape={noop} activeProfileIndex={active} onActiveProfileIndexChange={setActive} locale="de" readOnly />
    <header className="topbar"><Link href="/" className="brand" aria-label="Velvetia Startseite"><BrandLogo /></Link><span className="brand-slogan">Plan less. Ride more.</span><Link href="/" className="text-button">Eigene Tour planen <ArrowUpRight size={17} /></Link></header>
    <section className="shared-summary"><p className="eyebrow">Geteilte Route · Nur ansehen</p><h1>{route.name}</h1>{route.description && <p>{route.description}</p>}<div className="shared-metrics"><strong>{route.metrics.distanceKm}<small>km</small></strong><strong>{route.metrics.elevationGainM}<small>Höhenmeter</small></strong><strong>{Math.floor(route.metrics.durationMinutes / 60)}:{String(route.metrics.durationMinutes % 60).padStart(2, '0')}<small>Stunden</small></strong></div><ElevationProfile route={route} locale="de" activeIndex={active} onActiveIndexChange={setActive} /><button className="primary-button account-submit" onClick={() => downloadGpx(route)}><Download size={17} />GPX herunterladen</button></section>
  </main>
}
