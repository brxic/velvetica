import { spawn } from 'node:child_process'
import { createServer, request as proxyRequest } from 'node:http'
import { readFile } from 'node:fs/promises'

// Test-only localhost proxy: vary the real worker's bytes and serve a revocable
// share fixture. These endpoints are not part of the application or deployment.
let revision = 'baseline'
const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const build = await readFile(new URL('../public/pwa-build.js', import.meta.url), 'utf8')
const env = { ...process.env, DATABASE_URL: '', REDIS_URL: '', ROUTING_PROVIDER: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'qa-public-key-not-a-real-project', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3026'], { env, stdio: 'inherit' })
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:3027')
  if (url.pathname === '/__qa/worker-revision' && request.method === 'POST') { revision = url.searchParams.get('value') ?? 'baseline'; response.writeHead(204); response.end(); return }
  if (url.pathname === '/__qa/ready') { response.end('ready'); return }
  if (url.pathname === '/sw.js') { response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/' }); response.end(worker); return }
  if (url.pathname === '/pwa-build.js') { response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' }); response.end(`${build}// QA revision: ${revision}\n`); return }
  if (url.pathname === '/share/pwa-fixture') { response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); response.end('<!doctype html><title>Share fixture</title><h1>Freigabe-Testinhalt</h1>'); return }
  const upstream = proxyRequest({ hostname: '127.0.0.1', port: 3026, path: request.url, method: request.method, headers: request.headers }, (result) => { response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response) })
  upstream.on('error', () => { response.writeHead(503); response.end('Starting') })
  request.pipe(upstream)
})
server.listen(3027, '127.0.0.1')
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); next.kill(signal) })
next.on('exit', (code) => { server.close(); process.exit(code ?? 1) })
