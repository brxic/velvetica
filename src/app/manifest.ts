import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Velvetia — Plan less. Ride more.',
    short_name: 'Velvetia',
    description: 'Intelligente Fahrradrouten für die Schweiz.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f5f5f3',
    theme_color: '#1e2025',
    lang: 'de-CH',
    categories: ['navigation', 'sports', 'travel'],
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
