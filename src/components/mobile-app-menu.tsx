'use client'

import { Menu } from '@base-ui/react/menu'
import { CircleHelp, Languages, Menu as MenuIcon, Moon, Sun } from 'lucide-react'
import type { Locale } from '@/lib/domain'

export function MobileAppMenu({ locale, theme, onTheme, onLanguage, onGuide }: { locale: Locale; theme: 'light' | 'dark'; onTheme: () => void; onLanguage: () => void; onGuide: () => void }) {
  const de = locale === 'de'
  return <div className="mobile-app-menu"><Menu.Root>
    <Menu.Trigger className="icon-button" aria-label={de ? 'App-Menü' : 'App menu'}><MenuIcon size={21} /></Menu.Trigger>
    <Menu.Portal><Menu.Positioner className="ui-menu-positioner" side="bottom" align="end" sideOffset={8}><Menu.Popup className="ui-menu mobile-settings-menu">
      <Menu.Item className="ui-menu-item" onClick={onTheme}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}{theme === 'light' ? (de ? 'Dunkles Design' : 'Dark theme') : (de ? 'Helles Design' : 'Light theme')}</Menu.Item>
      <Menu.Item className="ui-menu-item" onClick={onLanguage}><Languages size={18} />{de ? 'English' : 'Deutsch'}</Menu.Item>
      <Menu.Item className="ui-menu-item" onClick={onGuide}><CircleHelp size={18} />{de ? 'So funktioniert’s' : 'How it works'}</Menu.Item>
    </Menu.Popup></Menu.Positioner></Menu.Portal>
  </Menu.Root></div>
}
