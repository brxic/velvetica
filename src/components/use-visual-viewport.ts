'use client'

import { useEffect } from 'react'

/** The keyboard may resize only the visual viewport, not fixed-position panels. */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let frame = 0
    const update = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        // Pinch zoom is not a keyboard resize; preserve the user's zoomed canvas.
        if (Math.abs(viewport.scale - 1) > .01) return
        const root = document.documentElement
        root.style.setProperty('--app-height', `${viewport.height}px`)
        root.style.setProperty('--visual-top', `${viewport.offsetTop}px`)
        root.style.setProperty('--keyboard-offset', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`)
        root.dataset.keyboardOpen = String(window.innerHeight - viewport.height > 120)
      })
    }
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    update()
    return () => {
      viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update)
      window.cancelAnimationFrame(frame)
      for (const property of ['--app-height', '--visual-top', '--keyboard-offset']) document.documentElement.style.removeProperty(property)
      delete document.documentElement.dataset.keyboardOpen
    }
  }, [])
}
