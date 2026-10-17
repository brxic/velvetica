import { spawn } from 'node:child_process'
await import('./prepare-map-assets.mjs')
// Explicitly remove cloud configuration: browser regressions never write to production.
const env = { ...process.env, ROUTING_PROVIDER: 'preview', ROUTING_FALLBACK: 'none', DATABASE_URL: '', REDIS_URL: '', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'qa-public-key-not-a-real-project', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3025'], { env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal))
server.on('exit', (code) => process.exit(code ?? 1))
