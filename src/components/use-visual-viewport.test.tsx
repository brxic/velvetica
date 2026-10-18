import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useVisualViewport } from './use-visual-viewport'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('tracks keyboard viewport changes, ignores pinch zoom and cleans up listeners and CSS', () => {
  const viewport = Object.assign(new EventTarget(), { height: 500, offsetTop: 10, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 850)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { callback(0); return 1 })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  const removed = vi.spyOn(viewport, 'removeEventListener')
  const { unmount } = renderHook(useVisualViewport)
  const style = document.documentElement.style
  expect(style.getPropertyValue('--app-height')).toBe('500px')
  expect(style.getPropertyValue('--keyboard-offset')).toBe('340px')
  expect(document.documentElement.dataset.keyboardOpen).toBe('true')
  act(() => { viewport.scale = 2; viewport.height = 250; viewport.dispatchEvent(new Event('resize')) })
  expect(style.getPropertyValue('--app-height')).toBe('500px')
  act(() => { viewport.scale = 1; viewport.height = 850; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('resize')) })
  expect(style.getPropertyValue('--keyboard-offset')).toBe('0px')
  unmount()
  expect(removed).toHaveBeenCalledTimes(2)
  expect(style.getPropertyValue('--app-height')).toBe('')
  expect(document.documentElement.dataset.keyboardOpen).toBeUndefined()
})
