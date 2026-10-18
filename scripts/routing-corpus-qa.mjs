import { mkdir, readFile, writeFile } from 'node:fs/promises'

// Explicit, local-only live-provider acceptance check. Never run this against
// production or automatically burden a public routing service during unit tests.
const base = new URL(process.env.ROUTING_QA_URL ?? 'http://127.0.0.1:3000')
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || base.username || base.password || !['http:', 'https:'].includes(base.protocol)) throw new Error('Use a loopback development server, not production.')
const references = JSON.parse(await readFile(new URL('../test-fixtures/routing-reference-cases.json', import.meta.url), 'utf8'))
const requested = process.argv.find((argument) => argument.startsWith('--case='))?.slice(7)
const selected = requested ? references.filter((entry) => entry.id === requested) : process.argv.includes('--all') ? references : references.filter((entry) => ['basel-rhein', 'bern-city', 'jura-gravel', 'alps-touring'].includes(entry.id))
if (!selected.length) throw new Error('Unknown reference case.')
const health = await (await fetch(new URL('/api/health', base), { redirect: 'error', signal: AbortSignal.timeout(8_000) })).json()
if (health.checks?.routing?.status !== 'up') throw new Error('A working live routing provider is required; previews do not qualify.')
const publicProvider = String(health.checks.routing.version).includes('FOSSGIS')
if (publicProvider && (!process.argv.includes('--public') || !requested || process.argv.includes('--profiles'))) throw new Error('Public provider detected. Choose one --case=... with --public; full corpus and profile comparisons require a local router.')
const output = new URL('../.data/routing-qa/', import.meta.url)
await mkdir(output, { recursive: true })
const results = []
let failures = 0
for (const entry of selected) {
  const modes = process.argv.includes('--profiles') ? ['one-way'] : ['round-trip', 'one-way']
  const profiles = process.argv.includes('--profiles') ? ['road', 'gravel', 'touring', 'city'] : [entry.profile]
  for (const mode of modes) for (const profile of profiles) {
  const id = `${entry.id}-${mode}-${profile}`
  const payload = { locale: 'de', profile: entry.profile, mode: 'round-trip', targetDistanceKm: entry.distanceKm, waypoints: [{ id: 'start', kind: 'start', label: entry.region, coordinate: entry.start }], preferences: { safety: 'quiet', climbing: 'balanced', surface: 'balanced' } }
  payload.mode = mode; payload.profile = profile
  if (mode === 'one-way') payload.waypoints.push({ id: 'end', kind: 'end', label: 'Ziel', coordinate: entry.end })
  const started = performance.now()
  try {
    const response = await fetch(new URL('/api/routes/plan', base), { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(65_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.json()).code ?? 'no acceptable route'}`)
    const route = await response.json()
    if (route.metrics.confidence === 'preview') throw new Error('Simulated preview is not a live routing check.')
    if (route.provenance.routingEngine === 'FOSSGIS OSRM Bike' && !process.argv.includes('--public')) throw new Error('Public provider detected. Stop here; use --public only after explicitly accepting its shared-service request budget.')
    await writeFile(new URL(`${id}.json`, output), JSON.stringify(route, null, 2))
    await writeFile(new URL(`${id}.geojson`, output), JSON.stringify({ type: 'Feature', properties: { name: route.name, profile, mode }, geometry: route.geometry }))
    results.push({ id, status: 'passed-technical', distanceKm: route.metrics.distanceKm, durationMs: Math.round(performance.now() - started), warnings: route.warnings, manualAccessReview: 'pending' })
    console.log(`${id}: ${route.metrics.distanceKm} km; ${route.provenance.routingEngine}; ${route.warnings.length} notes`)
    for (const warning of route.warnings) console.log(`  ${warning}`)
  } catch (error) { failures++; results.push({ id, status: 'failed', error: error.message }); console.error(`${id}: ${error.message}`) }
  }
}
await writeFile(new URL('report.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2))
await writeFile(new URL(`report-${requested ?? 'all'}${process.argv.includes('--profiles') ? '-profiles' : ''}.json`, output), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2))
console.log('Geometry checks do not certify legal access, closures or road suitability. Review the resulting routes on the map.')
process.exitCode = failures ? 1 : 0
