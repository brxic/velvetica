import { spawn } from 'node:child_process'

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env, timeout: command === 'docker' ? 90_000 : 120_000 })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)))
  })
}
const env = { ...process.env, DATABASE_URL: 'postgresql://velvetia_test:test-only-not-for-production@127.0.0.1:54328/velvetia_test' }
try {
  await run('docker', ['compose', '-f', 'compose.qa.yaml', 'up', '-d', '--wait'])
  await run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration.config.ts'], env)
  await run(process.execPath, ['scripts/database-qa.mjs'], env)
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { await run('docker', ['compose', '-f', 'compose.qa.yaml', 'down']).catch((error) => { console.error(error.message); process.exitCode = 1 }) }
