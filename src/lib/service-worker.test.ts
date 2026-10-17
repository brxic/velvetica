// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const source = readFileSync(resolve('public/sw.js'), 'utf8')
type TestEvent = { request?: { url: string; method: string; mode: string }; data?: { type: string }; ports?: { postMessage: ReturnType<typeof vi.fn> }[]; source?: { id: string }; waitUntil?: (promise: Promise<unknown>) => void; respondWith?: (promise: Promise<Response>) => void }
function worker() {
  const handlers = new Map<string, (event: TestEvent) => void>()
  const entries = new Map<string, Response>()
  const key = (request: string | { url: string }) => new URL(typeof request === 'string' ? request : request.url, 'https://velvetia.test').href
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), put: vi.fn(async (request: string | { url: string }, response: Response) => { entries.set(key(request), response) }), match: vi.fn(async (request: string | { url: string }) => entries.get(key(request))?.clone()) }
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue(['unrelated-cache', 'velvetia-shell-v1']), delete: vi.fn().mockResolvedValue(true) }
  const clients = { matchAll: vi.fn().mockResolvedValue([{ id: 'current' }]), claim: vi.fn().mockResolvedValue(undefined) }
  const skipWaiting = vi.fn().mockResolvedValue(undefined)
  const fetch = vi.fn().mockImplementation(async () => new Response('<html>public shell</html>', { headers: { 'content-type': 'text/html' } }))
  runInNewContext(source, { importScripts: vi.fn(), self: { location: { origin: 'https://velvetia.test' }, addEventListener: (name: string, fn: (event: TestEvent) => void) => handlers.set(name, fn), clients, skipWaiting }, caches, fetch, URL, Response })
  async function dispatch(name: string, event: TestEvent = {}) { let done: Promise<unknown> = Promise.resolve(); handlers.get(name)?.({ ...event, waitUntil: (promise) => { done = promise } }); await done }
  function request(path: string, mode = 'navigate', method = 'GET') { let result: Promise<Response> | undefined; handlers.get('fetch')?.({ request: { url: new URL(path, 'https://velvetia.test').href, method, mode }, respondWith: (promise) => { result = promise } }); return result }
  return { cache, caches, clients, entries, skipWaiting, fetch, dispatch, request }
}

describe('production service worker policy', () => {
  it('does not skip waiting on install and removes only old Velvetia caches', async () => {
    const sw = worker(); await sw.dispatch('install'); expect(sw.skipWaiting).not.toHaveBeenCalled()
    await sw.dispatch('activate'); expect(sw.caches.delete).toHaveBeenCalledExactlyOnceWith('velvetia-shell-v1')
  })
  it('requires one matching client before an explicitly requested update', async () => {
    const sw = worker(); const port = { postMessage: vi.fn() }
    sw.clients.matchAll.mockResolvedValueOnce([{ id: 'current' }, { id: 'another' }])
    await sw.dispatch('message', { data: { type: 'APPLY_UPDATE' }, source: { id: 'current' }, ports: [port] })
    expect(sw.skipWaiting).not.toHaveBeenCalled(); expect(port.postMessage).toHaveBeenLastCalledWith({ type: 'UPDATE_BLOCKED' })
    await sw.dispatch('message', { data: { type: 'APPLY_UPDATE' }, source: { id: 'wrong' }, ports: [port] })
    expect(sw.skipWaiting).not.toHaveBeenCalled()
    await sw.dispatch('message', { data: { type: 'APPLY_UPDATE' }, source: { id: 'current' }, ports: [port] })
    expect(sw.skipWaiting).toHaveBeenCalledOnce(); expect(port.postMessage).toHaveBeenLastCalledWith({ type: 'UPDATE_ACCEPTED' })
  })
  it('caches only root HTML; shares, queries, API, auth, RSC and external maps are excluded', async () => {
    const sw = worker(); await sw.request('/')
    expect(sw.cache.put).toHaveBeenCalledOnce(); sw.cache.put.mockClear()
    for (const path of ['/share/private-link', '/?code=secret', '/auth/callback', '/api/saved-routes']) await sw.request(path)
    await sw.request('/?_rsc=one', 'cors'); await sw.request('https://tiles.example/a.png', 'cors')
    expect(sw.cache.put).not.toHaveBeenCalled()
  })
  it('serves root shell offline but never serves a previously cached share', async () => {
    const sw = worker(); await sw.request('/')
    sw.entries.set('https://velvetia.test/offline.html', new Response('Offline fallback'))
    sw.entries.set('https://velvetia.test/share/secret', new Response('revoked private content'))
    sw.fetch.mockRejectedValue(new TypeError('offline'))
    expect(await (await sw.request('/'))?.text()).toContain('public shell')
    expect(await (await sw.request('/share/secret'))?.text()).toBe('Offline fallback')
    expect(await (await sw.request('/?code=secret'))?.text()).toBe('Offline fallback')
  })
  it('warms .mjs workers and serves them offline without duplicate network requests', async () => {
    const sw = worker(); await sw.request('/maplibre/maplibre-gl-worker.mjs', 'cors')
    sw.fetch.mockRejectedValue(new TypeError('offline'))
    expect((await sw.request('/maplibre/maplibre-gl-worker.mjs', 'cors'))?.ok).toBe(true)
    expect(sw.fetch).toHaveBeenCalledOnce()
  })
  it('a cache quota failure does not hide a successful network response', async () => {
    const sw = worker(); sw.cache.put.mockRejectedValue(new Error('quota'))
    expect((await sw.request('/'))?.ok).toBe(true)
    expect((await sw.request('/pwa-192.png', 'cors'))?.ok).toBe(true)
  })
  it('denied cache access does not break online navigation or static files', async () => {
    const sw = worker(); sw.caches.open.mockRejectedValue(new Error('storage denied'))
    expect((await sw.request('/'))?.ok).toBe(true)
    expect((await sw.request('/maplibre/maplibre-gl-worker.mjs', 'cors'))?.ok).toBe(true)
  })
})
