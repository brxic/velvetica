import { readFile } from 'node:fs/promises'

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
if (String(health.checks.routing.version).includes('FOSSGIS') && !process.argv.includes('--public')) throw new Error('Public provider detected. Use --public only after accepting its shared-service request budget.')
let failures = 0
for (const entry of selected) {
  const payload = { locale: 'de', profile: entry.profile, mode: 'round-trip', targetDistanceKm: entry.distanceKm, waypoints: [{ id: 'start', kind: 'start', label: entry.region, coordinate: entry.start }], preferences: { safety: 'quiet', climbing: 'balanced', surface: 'balanced' } }
  try {
    const response = await fetch(new URL('/api/routes/plan', base), { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(65_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}: no acceptable route`)
    const route = await response.json()
    if (route.metrics.confidence === 'preview') throw new Error('Simulated preview is not a live routing check.')
    if (route.provenance.routingEngine === 'FOSSGIS OSRM Bike' && !process.argv.includes('--public')) throw new Error('Public provider detected. Stop here; use --public only after explicitly accepting its shared-service request budget.')
    console.log(`${entry.id}: ${route.metrics.distanceKm} km; ${route.provenance.routingEngine}; ${route.warnings.length} notes`)
    for (const warning of route.warnings) console.log(`  ${warning}`)
  } catch (error) { failures++; console.error(`${entry.id}: ${error.message}`); if (!process.argv.includes('--public')) break }
}
console.log('Geometry checks do not certify legal access, closures or road suitability. Review the resulting routes on the map.')
process.exitCode = failures ? 1 : 0
