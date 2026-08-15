import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const foundry = localFont({
  src: [
    { path: '../../fonts/fcm-font/Foundry Context W03 Md/Web Fonts/290722743dd14bbba7ce7bc395d9bf05.woff2', weight: '500', style: 'normal' },
    { path: '../../fonts/fcb-font/Foundry Context W03 Bd/Web Fonts/4dde1c6aefbaf4bbe3eaac8039d78085.woff2', weight: '700', style: 'normal' },
  ], variable: '--font-foundry', display: 'swap',
})

export const metadata: Metadata = { title: 'Velvetia — Plan less. Ride more.', description: 'Intelligente Fahrradrouten für die Schweiz.' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f5f5f3' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" className={foundry.variable}><body>{children}</body></html>
}

