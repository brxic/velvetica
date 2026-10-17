'use client'

import type { ComponentProps, ReactNode } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'

export function UiProvider({ children }: { children: ReactNode }) { return <Tooltip.Provider delay={450}>{children}</Tooltip.Provider> }

export function Button({ variant = 'secondary', busy = false, className = '', children, disabled, ...props }: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'text' | 'icon'; busy?: boolean }) {
  const control = <button type="button" {...props} className={`${variant === 'icon' ? 'icon-button' : `${variant}-button`} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined}>{busy ? <span className="spinner" aria-hidden="true" /> : null}{children}</button>
  return variant === 'icon' && props['aria-label'] ? <Tooltip.Root><Tooltip.Trigger render={control} /><Tooltip.Portal><Tooltip.Positioner className="ui-tooltip-positioner" sideOffset={8}><Tooltip.Popup className="ui-tooltip">{props['aria-label']}</Tooltip.Popup></Tooltip.Positioner></Tooltip.Portal></Tooltip.Root> : control
}
