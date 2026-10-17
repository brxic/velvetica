import { spawn } from 'node:child_process'

// Genuine production build, isolated from all configured cloud data.
const env = { ...process.env, ROUTING_PROVIDER: 'preview', ROUTING_FALLBACK: 'none', DATABASE_URL: '', REDIS_URL: '', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'qa-public-key-not-a-real-project', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }
function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit' })
    child.on('error', () => resolve(1))
    child.on('exit', (code) => resolve(code ?? 1))
  })
}
await import('./prepare-map-assets.mjs')
await import('./prepare-pwa.mjs')
const built = await run(['node_modules/next/dist/bin/next', 'build'])
if (built !== 0) process.exit(built)
process.exit(await run(['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.pwa.config.ts']))
