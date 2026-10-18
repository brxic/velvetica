import { test, expect, type Page } from '@playwright/test'
import type { PlannedRoute, Waypoint } from '../src/lib/domain'

async function prepare(page: Page) {
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await page.route('**/styles/ch.swisstopo.lightbasemap.vt/style.json', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fafafa' } }] } }))
  await page.goto('/')
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
}

test('recover an unsaved route and discard it explicitly without resurrecting it', async ({ page }) => {
  await prepare(page)
  const name = page.getByRole('textbox', { name: 'Routenname', exact: true })
  await name.fill('Aare Entwurf ohne Cloud')
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('velvetia.workspace.v1.') && localStorage.getItem(key)?.includes('Aare Entwurf ohne Cloud')))).toBe(true)
  page.on('dialog', (dialog) => dialog.accept())
  await page.reload()
  const recovery = page.getByRole('dialog', { name: 'Entwurf wiederherstellen', exact: true })
  await expect(recovery).toBeVisible()
  await recovery.getByRole('button', { name: 'Wiederherstellen', exact: true }).click()
  await expect(name).toHaveValue('Aare Entwurf ohne Cloud')
  await expect(page.getByRole('status')).toContainText('Nicht automatisch in der Cloud gespeichert')
  await page.reload()
  await recovery.getByRole('button', { name: 'Entwurf verwerfen', exact: true }).click()
  await page.reload()
  await expect(recovery).not.toBeVisible()
  await expect(name).not.toBeVisible()
})

test('recover planning points without a generated route', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await page.route('**/api/places/search?**', (route) => route.fulfill({ json: { results: [{ label: 'Bern, Schweiz', coordinate: [7.4474, 46.948] }] } }))
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Startort suchen' }).fill('Bern')
  await page.getByRole('option', { name: 'Bern, Schweiz', exact: true }).click()
  await page.getByRole('button', { name: 'Gravel', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('velvetia.workspace.v1.') && localStorage.getItem(key)?.includes('"profile":"gravel"')))).toBe(true)
  await page.reload()
  await page.getByRole('dialog', { name: 'Entwurf wiederherstellen' }).getByRole('button', { name: 'Wiederherstellen', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Startort suchen' })).toHaveValue('Bern, Schweiz')
  await expect(page.getByRole('button', { name: 'Gravel', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('an invalid edit restores required points and preserves the complete route and export', async ({ page }) => {
  await prepare(page)
  const before = await page.getByRole('textbox', { name: 'Routenname', exact: true }).inputValue()
  const toggle = page.getByRole('button', { name: 'Planungsmenü öffnen' })
  if (await toggle.isVisible()) await toggle.click()
  const rows = await page.locator('.location-row').count()
  await page.route('**/api/routes/plan', (route) => route.fulfill({ status: 422, json: { code: 'ROUTE_QUALITY_FAILED' } }))
  // Removing an internal GPX shaping point starts a real editor recomputation.
  const buttons = page.locator('.location-row button')
  if (rows > 2) await buttons.nth(1).click()
  else await buttons.first().click()
  await expect(page.locator('.location-row')).toHaveCount(rows)
  const close = page.getByRole('button', { name: 'Planungsmenü schliessen' })
  if (await close.isVisible()) await close.click()
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toHaveValue(before)
  await expect(page.getByRole('button', { name: 'GPX exportieren', exact: true })).toBeEnabled()
})

test('router errors provide distinct actionable feedback and retain the route', async ({ page }) => {
  await prepare(page)
  const codes = [
    ['NO_ROUTE', 'keine Fahrradverbindung'], ['ROUTER_TIMEOUT', 'dauert zu lange'], ['ROUTER_UNAVAILABLE', 'nicht erreichbar'], ['ROUTE_QUALITY_FAILED', 'keine ausreichend plausible'],
  ]
  for (const [code, message] of codes) {
    const toggle = page.getByRole('button', { name: 'Planungsmenü öffnen' })
    if (await toggle.isVisible()) await toggle.click()
    await page.route('**/api/routes/plan', (route) => route.fulfill({ status: 422, json: { code } }))
    await page.getByRole('button', { name: 'Route planen', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Entwurf verwerfen' }).click()
    await expect(page.getByRole('status')).toContainText(message)
    await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toBeVisible()
  }
})

test('a late routing response cannot replace a newer map edit', async ({ page }) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  await page.getByRole('button', { name: 'Route bearbeiten', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('velvetia.workspace.v1.')))).toBe(true)
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('velvetia.workspace.v1.'))!)!).workspace.route) as PlannedRoute
  let releaseFirst!: () => void
  const first = new Promise<void>((resolve) => { releaseFirst = resolve })
  let count = 0, handled = false
  await page.route('**/api/routes/plan', async (route) => {
    const ordinal = ++count
    const request = route.request().postDataJSON() as { waypoints: Waypoint[] }
    if (ordinal === 1) await first
    await route.fulfill({ status: 201, json: { ...original, waypoints: request.waypoints, metrics: { ...original.metrics, distanceKm: ordinal === 1 ? 77 : 12 } } })
    if (ordinal === 1) handled = true
  })
  await page.locator('.map-marker--start').waitFor()
  const canvas = page.locator('.maplibregl-canvas')
  // Responsive panel insets change marker positions. Target genuinely open map,
  // not a fixed screen coordinate that can now be the destination marker.
  async function clickOpenMap() {
    const position = await canvas.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      for (const y of [180, 205, 230]) for (const ratio of [.75, .65, .5, .85]) {
        const x = bounds.left + bounds.width * ratio
        if (document.elementFromPoint(x, bounds.top + y) === element) return { x: bounds.width * ratio, y }
      }
      throw new Error('No unobstructed map point found')
    })
    await canvas.click({ position })
  }
  await clickOpenMap()
  await expect.poll(() => count).toBe(1)
  await clickOpenMap()
  await expect.poll(() => count).toBe(2)
  await expect(page.getByText('12 km', { exact: true })).toBeVisible()
  releaseFirst()
  await expect.poll(() => handled).toBe(true)
  await expect(page.getByText('12 km', { exact: true })).toBeVisible()
  await expect(page.getByText('77 km', { exact: true })).not.toBeVisible()
})
