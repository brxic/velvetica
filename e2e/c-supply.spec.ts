import { expect, test, type Page } from '@playwright/test'
import type { PlannedRoute, Waypoint } from '../src/lib/domain'

const result = { pois: [{ id: 'node/123', category: 'water', name: 'QA Aarebrunnen', coordinate: [7.454, 46.953], openingHours: null, drinkingWater: 'yes', access: null, sourceUpdatedAt: null, offsetM: 90, alongKm: .6 }], truncated: false, corridorM: 500, source: { regionId: 'ch', snapshotAt: '2026-08-01T00:00:00Z', importedAt: '2026-10-18T00:00:00Z' } }
async function storedRoute(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('velvetia.workspace.v1.'))!)!).workspace.route) as Promise<PlannedRoute>
}
async function prepare(page: Page) {
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await page.route('**/styles/ch.swisstopo.lightbasemap.vt/style.json', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fafafa' } }] } }))
  await page.goto('/')
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('velvetia.workspace.v1.')))).toBe(true)
  return storedRoute(page)
}
async function mockLeg(page: Page, original: PlannedRoute) {
  await page.route('**/api/routes/plan', (r) => {
    const { waypoints } = r.request().postDataJSON() as { waypoints: Waypoint[] }
    return r.fulfill({ status: 201, json: { ...original, waypoints, geometry: { type: 'LineString', coordinates: waypoints.map((point) => point.coordinate) }, metrics: { ...original.metrics, confidence: 'verified' }, provenance: { ...original.provenance, routingEngine: 'Valhalla test' } } })
  })
}

test('supply is opt-in; preview and discard preserve the route; accept and undo are explicit', async ({ page }, info) => {
  let queries = 0
  await page.route('**/api/pois/nearby', (r) => { queries++; return r.fulfill({ json: result }) })
  const original = await prepare(page)
  expect(queries).toBe(0)
  await mockLeg(page, original)
  await page.getByRole('button', { name: 'Versorgung entlang der Route', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Versorgung entlang der Route', exact: true })
  await panel.getByRole('button', { name: /QA Aarebrunnen/ }).click()
  await expect(panel.getByText('Unbekannt', { exact: true })).toBeVisible()
  await expect(panel.getByText(/Wasserqualität sind nicht vor Ort geprüft/)).toBeVisible()
  await panel.getByRole('button', { name: 'Umweg berechnen', exact: true }).click()
  await expect(panel.getByRole('region', { name: 'Umwegvorschau' })).toBeVisible()
  await page.locator('.maplibregl-canvas').click({ position: { x: 70, y: 160 } })
  await expect(panel).toBeVisible()
  expect((await storedRoute(page)).geometry).toEqual(original.geometry)
  await page.screenshot({ path: info.outputPath('supply-preview.png') })
  await panel.getByRole('button', { name: 'Vorschau verwerfen' }).click()
  expect((await storedRoute(page)).geometry).toEqual(original.geometry)
  await panel.getByRole('button', { name: 'Umweg berechnen', exact: true }).click()
  await panel.getByRole('button', { name: 'Stopp übernehmen' }).click()
  await expect(panel).not.toBeVisible()
  await expect.poll(async () => (await storedRoute(page)).waypoints.some((point) => point.label === 'QA Aarebrunnen')).toBe(true)
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  await page.getByRole('button', { name: 'Versorgung entlang der Route', exact: true }).click()
  await panel.getByRole('button', { name: 'Letzten Stopp rückgängig' }).click()
  await expect.poll(async () => (await storedRoute(page)).geometry).toEqual(original.geometry)
  await expect.poll(async () => (await storedRoute(page)).waypoints).toEqual(original.waypoints)
  expect(queries).toBeLessThanOrEqual(3)
})

test('accepted stops can be removed through waypoint editing and undone exactly', async ({ page }) => {
  await page.route('**/api/pois/nearby', (r) => r.fulfill({ json: result }))
  const original = await prepare(page); await mockLeg(page, original)
  await page.getByRole('button', { name: 'Versorgung entlang der Route', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Versorgung entlang der Route', exact: true })
  await panel.getByRole('button', { name: /QA Aarebrunnen/ }).click()
  await panel.getByRole('button', { name: 'Umweg berechnen', exact: true }).click()
  await panel.getByRole('button', { name: 'Stopp übernehmen' }).click()
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  await expect.poll(async () => (await storedRoute(page)).waypoints.length).toBe(original.waypoints.length + 1)
  const accepted = await storedRoute(page)
  await page.getByRole('button', { name: 'Versorgung entlang der Route', exact: true }).click()
  await panel.getByRole('button', { name: 'Stopps über Wegpunkte bearbeiten' }).click()
  const editor = page.getByRole('dialog', { name: 'Wegpunkte bearbeiten', exact: true })
  await expect(editor.getByRole('combobox', { name: 'Zwischenpunkt suchen', exact: true })).toHaveValue('QA Aarebrunnen')
  await editor.getByRole('button', { name: 'Zwischenpunkt entfernen' }).click()
  await expect.poll(async () => (await storedRoute(page)).waypoints.length).toBe(original.waypoints.length)
  await editor.getByRole('button', { name: 'Schliessen', exact: true }).click()
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click()
  await expect.poll(async () => (await storedRoute(page)).geometry).toEqual(accepted.geometry)
})

test('failure and empty results are honest and do not block export or trigger searches on map movement', async ({ page }) => {
  let fail = true, queries = 0
  await page.route('**/api/pois/nearby', (r) => { queries++; return r.fulfill({ status: fail ? 503 : 200, json: fail ? {} : { ...result, pois: [] } }) })
  await prepare(page)
  await page.getByRole('button', { name: 'Versorgung entlang der Route', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Versorgung entlang der Route', exact: true })
  await expect(panel.getByText(/Versorgung derzeit nicht verfügbar/)).toBeVisible()
  fail = false
  await panel.getByRole('button', { name: 'Erneut versuchen' }).click()
  await expect(panel.getByText(/Das bedeutet nicht, dass es keine Versorgung gibt/)).toBeVisible()
  await panel.getByRole('button', { name: 'Schliessen', exact: true }).click()
  const before = queries
  const canvas = page.locator('.maplibregl-canvas')
  await canvas.click({ position: { x: 70, y: 180 } })
  expect(queries).toBe(before)
  await expect(page.getByRole('button', { name: 'GPX exportieren', exact: true })).toBeEnabled()
})

test('failed or cancelled detours never replace the route, including late replies', async ({ page }) => {
  await page.route('**/api/pois/nearby', (r) => r.fulfill({ json: result }))
  const original = await prepare(page)
  await page.route('**/api/routes/plan', (r) => r.fulfill({ status: 503, json: { code: 'ROUTER_UNAVAILABLE' } }))
  await page.getByRole('button', { name: 'Versorgung entlang der Route', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Versorgung entlang der Route', exact: true })
  await panel.getByRole('button', { name: /QA Aarebrunnen/ }).click()
  await panel.getByRole('button', { name: 'Umweg berechnen', exact: true }).click()
  await expect(panel.getByText(/Routingdienst ist gerade nicht erreichbar/)).toBeVisible()
  expect((await storedRoute(page)).geometry).toEqual(original.geometry)
  let release!: () => void, handled = false
  const wait = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/api/routes/plan', async (r) => { await wait; await r.fulfill({ status: 201, json: original }); handled = true })
  await panel.getByRole('button', { name: 'Umweg berechnen', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Umweg wird berechnet …' })).toBeVisible()
  await panel.getByRole('button', { name: 'Schliessen', exact: true }).click()
  release()
  await expect.poll(() => handled).toBe(true)
  await expect(panel).not.toBeVisible()
  expect((await storedRoute(page)).geometry).toEqual(original.geometry)
})

test('category filtering is explicit and browser back closes supplies', async ({ page }) => {
  const categories: string[][] = []
  await page.route('**/api/pois/nearby', (r) => { categories.push(r.request().postDataJSON().categories); return r.fulfill({ json: result }) })
  await prepare(page)
  await page.getByRole('button', { name: 'Versorgung entlang der Route', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Versorgung entlang der Route', exact: true })
  await expect(panel.getByRole('button', { name: /QA Aarebrunnen/ })).toBeVisible()
  await panel.getByRole('button', { name: 'Cafés & Restaurants', exact: true }).click()
  await expect.poll(() => categories.at(-1)).toEqual(['water', 'shop'])
  await page.goBack()
  await expect(panel).not.toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toBeVisible()
})
