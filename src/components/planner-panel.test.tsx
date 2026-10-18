import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { PlannerPanel } from './planner-panel'

afterEach(cleanup)

it('minimises without unmounting fields and exposes a keyboard-operable reopen action', () => {
  render(<PlannerPanel open compact locale="de"><input aria-label="Entwurf" defaultValue="Bern" /></PlannerPanel>)
  const field = screen.getByLabelText('Entwurf')
  fireEvent.click(screen.getByRole('button', { name: 'Planung minimieren' }))
  expect(field.closest('[inert]')).not.toBeNull()
  expect(field).toHaveValue('Bern')
  fireEvent.click(screen.getByRole('button', { name: 'Planung aufklappen' }))
  expect(field.closest('[inert]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Planung minimieren' })).toHaveAttribute('aria-expanded', 'true')
})

it('restores form interactivity when rotating from a collapsed mobile panel to desktop', () => {
  const { rerender } = render(<PlannerPanel open compact locale="de"><input aria-label="Entwurf" /></PlannerPanel>)
  fireEvent.click(screen.getByRole('button', { name: 'Planung minimieren' }))
  rerender(<PlannerPanel open compact={false} locale="de"><input aria-label="Entwurf" /></PlannerPanel>)
  expect(screen.getByLabelText('Entwurf').closest('[inert]')).toBeNull()
  expect(screen.getByRole('complementary')).not.toHaveClass('is-peek')
})

it('keeps a fully closed panel out of the tab order', () => {
  render(<PlannerPanel open={false} compact locale="en"><input aria-label="Draft" /></PlannerPanel>)
  expect(screen.getByLabelText('Draft').closest('[inert]')).not.toBeNull()
})
