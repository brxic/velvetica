import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { Pool } from 'pg'

const url = new URL(process.env.DATABASE_URL ?? '')
if (url.hostname !== '127.0.0.1' || url.port !== '54328' || url.pathname !== '/velvetia_test') throw new Error('Restore QA only supports the isolated compose.qa.yaml database')
function exec(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', '-f', 'compose.qa.yaml', 'exec', '-T', 'database', ...args], { stdio: 'inherit' })
    child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Restore step exited ${code}`)))
  })
}
const source = new Pool({ connectionString: url.href })
let restored
try {
  await exec(['pg_dump', '-U', 'velvetia_test', '-d', 'velvetia_test', '--schema=app', '--schema=auth', '-Fc', '-f', '/tmp/velvetia-qa.dump'])
  await exec(['createdb', '-U', 'velvetia_test', 'velvetia_restore_test'])
  const restoreUrl = new URL(url.href); restoreUrl.pathname = '/velvetia_restore_test'
  restored = new Pool({ connectionString: restoreUrl.href })
  await restored.query('CREATE EXTENSION postgis')
  await exec(['pg_restore', '-U', 'velvetia_test', '-d', 'velvetia_restore_test', '--exit-on-error', '/tmp/velvetia-qa.dump'])
  for (const table of ['app.routes', 'app.route_versions', 'app.user_preferences', 'app.route_shares', 'auth.users', 'auth.sessions']) {
    const sql = `SELECT md5(COALESCE(string_agg(row_json, '' ORDER BY row_json), '')) AS checksum FROM (SELECT row_to_json(t)::text AS row_json FROM ${table} t) rows`
    assert.equal((await source.query(sql)).rows[0].checksum, (await restored.query(sql)).rows[0].checksum, `${table}: restored data differs`)
  }
  const count = await restored.query('SELECT count(*)::int AS count FROM app.routes')
  assert.ok(count.rows[0].count > 0, 'Restore must contain real synthetic route rows')
  console.log('Backup/restore verified: all six table checksums match; PostGIS route data and history restored.')
} finally { await source.end(); await restored?.end() }
