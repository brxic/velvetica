import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Onboarding } from './onboarding'
import { RouteShare } from './route-share'
import { t } from '@/lib/i18n'
import { RouteProvenance } from './route-provenance'
import { rideTestRoute } from '../../test-fixtures/ride-route'

afterEach(cleanup)

describe('product explanations', () => {
  it('never presents legacy query or import timestamps as source freshness', () => {
    render(<RouteProvenance locale="de" provenance={{ ...rideTestRoute.provenance, routingEngine: 'FOSSGIS OSRM Bike' }} />)
    expect(screen.getByText('Nicht bekannt')).toBeVisible()
    expect(screen.getByText('Ausgewertet')).toBeVisible()
  })
  it('distinguishes distance for round trips from destination for one-way routes', () => {
    render(<Onboarding locale="de" onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByText(/Für eine Rundtour gibst du die Distanz an, für One-Way ein Ziel/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByRole('button', { name: 'Zur Karte' })).toBeVisible()
  })
  it.each(['de', 'en'] as const)('explains that shared route geometry can reveal home (%s)', (locale) => {
    render(<RouteShare routeId="test-copy" locale={locale} open onOpenChange={() => undefined} />)
    expect(screen.getByRole('dialog', { name: locale === 'de' ? 'Route teilen' : 'Share route' })).toBeVisible()
    expect(screen.getByText(locale === 'de' ? /Liegt dein Zuhause auf der Route/ : /If your home is on the route/)).toBeVisible()
  })
  it('identifies simulated preview values and excludes riding use in both languages', () => {
    expect(t('de').previewInfo).toContain('nicht zum Nachfahren geeignet')
    expect(t('en').previewInfo).toContain('Do not use it for riding')
  })
})
