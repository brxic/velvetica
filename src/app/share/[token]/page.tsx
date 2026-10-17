import { readRouteShare } from '@/lib/saved-route-store'
import { SharedRoute } from '@/components/shared-route'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { PlannedRoute } from '@/lib/domain'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Geteilte Route · Velvetia', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let route: PlannedRoute | null = null
  let unavailable = false
  try { route = await readRouteShare(token) } catch { unavailable = true }
  if (unavailable) return <main className="error-page"><h1>Route gerade nicht erreichbar.</h1><p>Bitte versuche es in wenigen Minuten erneut.</p><Link className="primary-button" href="/">Zum Routenplaner</Link></main>
  return route ? <SharedRoute route={route} /> : <main className="error-page"><p className="eyebrow">Velvetia</p><h1>Dieser Link ist nicht mehr gültig.</h1><p>Die Freigabe wurde widerrufen oder die Route gelöscht.</p><Link className="primary-button" href="/">Eigene Route planen</Link></main>
}
