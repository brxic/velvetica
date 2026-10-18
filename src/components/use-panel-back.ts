'use client'

import { useEffect, useRef } from 'react'

const STATE_KEY = 'velvetiaWorkspacePanel'

/** One reversible history entry for the current workspace layer, not each render. */
export function usePanelBack(active: string | null, onBack: () => void) {
  const current = useRef({ active, onBack })
  const token = useRef('')
  const owned = useRef(false)
  const closing = useRef(false)
  useEffect(() => {
    token.current = crypto.randomUUID()
    const pop = () => {
      if (closing.current) {
        closing.current = false
        if (current.current.active) {
          history.pushState({ ...history.state, [STATE_KEY]: token.current }, '')
          owned.current = true
        }
        return
      }
      if (!owned.current || history.state?.[STATE_KEY] === token.current) return
      owned.current = false
      current.current.onBack()
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  useEffect(() => {
    current.current = { active, onBack }
    if (closing.current) return
    if (active && !owned.current) { history.pushState({ ...history.state, [STATE_KEY]: token.current }, ''); owned.current = true }
    else if (!active && owned.current) {
      owned.current = false
      if (history.state?.[STATE_KEY] === token.current) { closing.current = true; history.back() }
    }
  }, [active, onBack])
}
