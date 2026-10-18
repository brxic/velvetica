import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { PwaRegistration } from '@/components/pwa-registration'
import { UiProvider } from '@/components/ui/button'
import './globals.css'

const foundry = localFont({
  src: [
    { path: '../../fonts/fcm-font/Foundry Context W03 Md/Web Fonts/290722743dd14bbba7ce7bc395d9bf05.woff2', weight: '500', style: 'normal' },
    { path: '../../fonts/fcb-font/Foundry Context W03 Bd/Web Fonts/4dde1c6aefbaf4bbe3eaac8039d78085.woff2', weight: '700', style: 'normal' },
  ], variable: '--font-foundry', display: 'swap',
})

export const metadata: Metadata = {
  title: 'Velvetia: Plan less. Ride more.',
  description: 'Plane Fahrradrouten in der Schweiz und passe sie auf der Karte an.',
  applicationName: 'Velvetia',
  icons: { apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Velvetia' },
  formatDetection: { telephone: false },
  other: { 'mobile-web-app-capable': 'yes' },
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f3' },
    { media: '(prefers-color-scheme: dark)', color: '#1e2025' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de-CH" className={foundry.variable}><body><UiProvider>{children}<PwaRegistration /></UiProvider></body></html>
}
