import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SupplyCategoryPicker } from './supply-category-picker'

afterEach(cleanup)

it('exposes named choices and an explicit selected state instead of native-looking unstyled buttons', () => {
  const toggle = vi.fn()
  render(<SupplyCategoryPicker locale="de" selected={['water', 'shop']} onToggle={toggle} />)
  const food = screen.getByRole('button', { name: 'Cafés & Restaurants' })
  expect(food).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Trinkwasser' })).toHaveAttribute('aria-pressed', 'true')
  expect(food.querySelector('svg')).not.toBeNull()
  fireEvent.click(food)
  expect(toggle).toHaveBeenCalledWith('food')
})

it('uses the same selection model for the English workspace', () => {
  render(<SupplyCategoryPicker locale="en" selected={['shop']} onToggle={() => {}} />)
  expect(screen.getByRole('group', { name: 'Supply categories' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Groceries' })).toHaveAttribute('aria-pressed', 'true')
})
