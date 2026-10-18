import { spawn } from 'node:child_process'
await import('./prepare-map-assets.mjs')
await import('./prepare-pwa.mjs')
// Deliberately isolated from .env.local / production accounts and databases.
const env = { ...process.env, ROUTING_PROVIDER: 'valhalla', VALHALLA_URL: 'http://127.0.0.1:8002', ROUTING_FALLBACK: 'none', DATABASE_URL: '', REDIS_URL: '', NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3028'], { env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal))
server.on('exit', (code) => process.exit(code ?? 1))
