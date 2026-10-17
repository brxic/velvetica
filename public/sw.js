importScripts('/pwa-build.js')

const CACHE_PREFIX = 'velvetia-shell-'
const CACHE_NAME = `${CACHE_PREFIX}v2`
const OFFLINE_PAGE = '/offline.html'
const PRECACHE_URLS = [OFFLINE_PAGE, '/pwa-192.png', '/pwa-512.png', '/pwa-maskable-512.png']

async function remember(request, response) {
  try { const cache = await caches.open(CACHE_NAME); await cache.put(request, response.clone()) } catch { /* Best effort: quota or blocked storage must not hide successful network responses. */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(PRECACHE_URLS)
    // Updates wait for an explicit request. Never interrupt an open route draft.
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

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'APPLY_UPDATE' || !event.ports[0]) return
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Conservative cross-tab protection: another editor cannot be inspected here.
    if (windows.length !== 1 || windows[0].id !== event.source?.id) {
      event.ports[0].postMessage({ type: 'UPDATE_BLOCKED' })
      return
    }
    event.ports[0].postMessage({ type: 'UPDATE_ACCEPTED' })
    await self.skipWaiting()
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
        if (url.pathname === '/' && !url.search && response.ok && !response.redirected && response.headers.get('content-type')?.includes('text/html')) {
          await remember(request, response)
        }
        return response
      } catch {
        // Never resurrect revoked shares or auth callbacks from cached HTML.
        try {
          const cache = await caches.open(CACHE_NAME)
          return (url.pathname === '/' && !url.search ? await cache.match('/') : null) || (await cache.match(OFFLINE_PAGE)) || Response.error()
        } catch { return Response.error() }
      }
    })())
    return
  }

  const cacheableAsset = !url.search && (url.pathname.startsWith('/_next/static/')
    || /^\/maplibre\/[\w.-]+\.mjs$/.test(url.pathname)
    || /^\/[\w.-]+\.(?:png|ico|svg)$/.test(url.pathname))
  if (!cacheableAsset) return

  event.respondWith((async () => {
    let cached
    try { const cache = await caches.open(CACHE_NAME); cached = await cache.match(request) } catch { /* Online requests still work without cache access. */ }
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) {
      await remember(request, response)
    }
    return response
  })())
})
