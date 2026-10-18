import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SharedRoute } from './shared-route'
import { rideTestRoute } from '../../test-fixtures/ride-route'

vi.mock('./map-canvas', () => ({ MapCanvas: () => <div aria-label="Read-only map" /> }))
vi.mock('./brand-logo', () => ({ BrandLogo: () => <span>Velvetia</span> }))
vi.mock('./use-panel-back', () => ({ usePanelBack: () => {} }))
afterEach(cleanup)

it('shared routes reuse honest metrics and expose warnings in complete details', () => {
  render(<SharedRoute route={{ ...rideTestRoute, warnings: ['Sperrungen vor Ort beachten.'], metrics: { ...rideTestRoute.metrics, elevationAnalyzed: false, surfaceAnalyzed: false } }} />)
  expect(screen.getAllByText('—')).toHaveLength(2)
  expect(screen.queryByText('0 %')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Alle Details' }))
  expect(screen.getByRole('dialog', { name: 'Alle Routendetails' })).toBeVisible()
  expect(screen.getByText('Sperrungen vor Ort beachten.')).toBeVisible()
  expect(screen.getByText('Nicht analysiert')).toBeVisible()
})
