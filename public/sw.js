const CACHE_PREFIX = 'velvetia-shell-'
const CACHE_NAME = `${CACHE_PREFIX}v1`
const OFFLINE_PAGE = '/offline.html'
const PRECACHE_URLS = [OFFLINE_PAGE, '/pwa-192.png', '/pwa-512.png', '/pwa-maskable-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(PRECACHE_URLS)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
      .map((cacheName) => caches.delete(cacheName)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.webmanifest') return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(request, response.clone())
        }
        return response
      } catch {
        return (await caches.match(request)) || (await caches.match(OFFLINE_PAGE)) || Response.error()
      }
    })())
    return
  }

  const cacheableAsset = url.pathname.startsWith('/_next/static/')
    || /\.(?:css|js|png|jpg|jpeg|svg|ico|woff2?)$/i.test(url.pathname)
  if (!cacheableAsset) return

  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }
    return response
  })())
})
