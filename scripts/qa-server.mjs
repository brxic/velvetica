import { spawn } from 'node:child_process'
await import('./prepare-map-assets.mjs')
await import('./prepare-pwa.mjs')
// Explicitly remove cloud configuration: browser regressions never write to production.
const liveSupply = process.argv.includes('--supply')
const qaPort = process.env.VELVETIA_QA_DATABASE_PORT ?? '15432'
if (!/^\d{4,5}$/.test(qaPort) || Number(qaPort) < 1024 || Number(qaPort) > 65535) throw new Error('Invalid QA database port')
const env = { ...process.env, ROUTING_PROVIDER: liveSupply ? 'valhalla' : 'preview', VALHALLA_URL: 'http://127.0.0.1:8002', ROUTING_FALLBACK: 'none', DATABASE_URL: liveSupply ? `postgresql://velvetia_test:test-only-not-for-production@127.0.0.1:${qaPort}/velvetia_test` : '', REDIS_URL: '', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'qa-public-key-not-a-real-project', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3025'], { env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal))
server.on('exit', (code) => process.exit(code ?? 1))
