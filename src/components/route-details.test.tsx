import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { RouteDetails } from './route-details'
import { rideTestRoute } from '../../test-fixtures/ride-route'

afterEach(cleanup)
it('does not show missing Valhalla surface analysis as zero-percent asphalt', () => {
  render(<RouteDetails route={{ ...rideTestRoute, metrics: { ...rideTestRoute.metrics, surfaceAnalyzed: false, elevationAnalyzed: false } }} locale="de" speedKmh={null} activeIndex={null} onActiveIndexChange={() => {}} />)
  expect(screen.getByText('Nicht analysiert')).toBeVisible()
  expect(screen.queryByText('0 %')).not.toBeInTheDocument()
  expect(screen.getByText('Für diese Route sind keine Höhendaten verfügbar.')).toBeVisible()
})
