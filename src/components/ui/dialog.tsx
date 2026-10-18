'use client'

import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'

/** Modal focus containment/return; nonmodal workspace panels keep map interaction available. */
export function AppDialog({ open, onOpenChange, label, children, className = '', placement = 'center', finalFocus, initialFocus, modal = true, style }: { open: boolean; onOpenChange: (open: boolean) => void; label: string; children: ReactNode; className?: string; placement?: 'center' | 'end' | 'sheet'; finalFocus?: ComponentProps<typeof Dialog.Popup>['finalFocus']; initialFocus?: ComponentProps<typeof Dialog.Popup>['initialFocus']; modal?: boolean; style?: CSSProperties }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal} disablePointerDismissal={!modal}>
    <Dialog.Portal>
      {modal && <Dialog.Backdrop className="ui-backdrop" />}
      <Dialog.Viewport className={`ui-dialog-viewport ui-dialog-viewport--${placement} ${modal ? '' : 'ui-dialog-viewport--nonmodal'}`}>
        <Dialog.Popup className={`ui-dialog ${className}`} style={style} finalFocus={finalFocus} initialFocus={initialFocus}>
          <Dialog.Title render={<span className="sr-only" />}>{label}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
}
