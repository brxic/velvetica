'use client'

import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'

/** One overlay contract: focus containment/return, Escape, inert background and scroll lock. */
export function AppDialog({ open, onOpenChange, label, children, className = '', placement = 'center' }: { open: boolean; onOpenChange: (open: boolean) => void; label: string; children: ReactNode; className?: string; placement?: 'center' | 'end' | 'sheet' }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className="ui-backdrop" />
      <Dialog.Viewport className={`ui-dialog-viewport ui-dialog-viewport--${placement}`}>
        <Dialog.Popup className={`ui-dialog ${className}`}>
          <Dialog.Title render={<span className="sr-only" />}>{label}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
}
