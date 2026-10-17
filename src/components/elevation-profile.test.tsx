import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlannedRoute } from '@/lib/domain'
import { ElevationProfile } from './elevation-profile'

afterEach(cleanup)
const route = { geometry: { type: 'LineString', coordinates: [[7, 47], [7.001, 47], [7.1, 47]] }, metrics: { elevationProfile: [500, 510, 600], distanceKm: 999 }, provenance: { routingEngine: 'GPX Import' } } as PlannedRoute

describe('distance-based elevation profile', () => {
  it('positions uneven vertices by distance and shares coordinate indices with the map', () => {
    const select = vi.fn()
    const { container } = render(<ElevationProfile route={route} locale="de" activeIndex={1} onActiveIndexChange={select} />)
    const points = container.querySelector('polyline')!.getAttribute('points')!.split(' ')
    expect(Number(points[1].split(',')[0])).toBeCloseTo(1, 2)
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toContain('0.1 km, 510 m')
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' })
    expect(select).toHaveBeenLastCalledWith(2)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'Home' })
    expect(select).toHaveBeenLastCalledWith(0)
  })
})
