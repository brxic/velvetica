'use client'

import { useEffect, useRef } from 'react'

export function useDialogFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const element = ref.current
    const targets = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, a[href], [tabindex="0"]') ?? []).filter((item) => item.getClientRects().length)
    targets()[0]?.focus()
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab') return
      const items = targets()
      const first = items[0], last = items.at(-1)
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || !element?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !element?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handler)
    return () => { document.removeEventListener('keydown', handler); previous?.focus() }
  }, [open])
  return ref
}
