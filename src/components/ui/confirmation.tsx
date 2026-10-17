'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/domain'
import { Button } from './button'

export function useConfirmation(locale: Locale) {
  const [message, setMessage] = useState<string | null>(null)
  const resolveRef = useRef<((accepted: boolean) => void) | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => () => { resolveRef.current?.(false) }, [])
  function close(accepted: boolean) { resolveRef.current?.(accepted); resolveRef.current = null; setMessage(null) }
  function confirm(text: string) {
    if (resolveRef.current) return Promise.resolve(false)
    setMessage(text)
    return new Promise<boolean>((resolve) => { resolveRef.current = resolve })
  }
  const de = locale === 'de'
  const confirmation = <AlertDialog.Root open={message !== null} onOpenChange={(open) => { if (!open) close(false) }}>
    <AlertDialog.Portal><AlertDialog.Backdrop className="ui-backdrop" /><AlertDialog.Viewport className="ui-dialog-viewport"><AlertDialog.Popup className="ui-dialog confirmation-dialog" initialFocus={cancelRef}>
      <AlertDialog.Title>{de ? 'Entwurf verlassen?' : 'Leave this draft?'}</AlertDialog.Title>
      <AlertDialog.Description>{message}</AlertDialog.Description>
      <div className="confirmation-actions"><Button ref={cancelRef} onClick={() => close(false)}>{de ? 'Weiter bearbeiten' : 'Keep editing'}</Button><Button variant="primary" onClick={() => close(true)}>{de ? 'Entwurf verwerfen' : 'Discard draft'}</Button></div>
    </AlertDialog.Popup></AlertDialog.Viewport></AlertDialog.Portal>
  </AlertDialog.Root>
  return { confirm, confirmation }
}
