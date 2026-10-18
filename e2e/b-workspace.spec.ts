import { expect, test, type Page } from '@playwright/test'
import type { PlannedRoute, Waypoint } from '../src/lib/domain'

async function prepare(page: Page) {
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await page.route('**/styles/ch.swisstopo.lightbasemap.vt/style.json', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fafafa' } }] } }))
  await page.goto('/')
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith('velvetia.workspace.v1.')))).toBe(true)
}

test('browsing cannot change geometry; editing is explicit and reversible', async ({ page }) => {
  await prepare(page)
  let requests = 0
  await page.route('**/api/routes/plan', (route) => { requests++; return route.fulfill({ status: 422, json: { code: 'NO_ROUTE' } }) })
  const canvas = page.locator('.maplibregl-canvas')
  await expect(page.locator('.map-marker--start')).toBeDisabled()
  await canvas.click({ position: { x: page.viewportSize()!.width * .75, y: 200 } })
  expect(requests).toBe(0)
  await page.getByRole('button', { name: 'Route bearbeiten', exact: true }).click()
  await expect(page.locator('.map-marker--start')).toBeEnabled()
  await canvas.click({ position: { x: page.viewportSize()!.width * .75, y: 200 } })
  await expect.poll(() => requests).toBe(1)
  await expect(page.getByRole('button', { name: 'Fertig', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(page.locator('.map-marker--start')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'GPX exportieren', exact: true })).toBeEnabled()
})

test('waypoints support keyboard search, reorder, removal and undo without losing the route name', async ({ page }) => {
  await prepare(page)
  const name = page.getByRole('textbox', { name: 'Routenname', exact: true })
  await name.fill('Meine Aare-Runde')
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((key) => key.startsWith('velvetia.workspace.v1.'))!)!).workspace.route) as PlannedRoute
  const requests: Waypoint[][] = []
  await page.route('**/api/routes/plan', (route) => {
    const { waypoints } = route.request().postDataJSON() as { waypoints: Waypoint[] }
    requests.push(waypoints)
    return route.fulfill({ status: 201, json: { ...original, waypoints } })
  })
  await page.route('**/api/places/search?**', (route) => route.fulfill({ json: { results: [{ label: 'Aare, Bern', coordinate: [7.45, 46.95] }] } }))
  await page.getByRole('button', { name: 'Route bearbeiten', exact: true }).click()
  await page.getByRole('button', { name: 'Wegpunkte', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Wegpunkte bearbeiten', exact: true })
  await expect(dialog.getByRole('button', { name: 'Zwischenpunkt entfernen' })).not.toBeVisible()
  const search = dialog.getByRole('combobox', { name: 'Neuen Zwischenpunkt suchen' })
  await search.fill('Aare')
  await expect(page.getByRole('option', { name: 'Aare, Bern', exact: true })).toBeVisible()
  await search.press('ArrowDown'); await search.press('Enter')
  await expect(dialog.getByRole('button', { name: 'Zwischenpunkt entfernen' })).toBeEnabled()
  await expect.poll(() => requests.length).toBe(1)
  await search.fill('Aare')
  await expect(page.getByRole('option', { name: 'Aare, Bern', exact: true })).toBeVisible()
  await search.press('ArrowDown'); await search.press('Enter')
  await expect.poll(() => requests.length).toBe(2)
  const addedId = requests[1].find((point) => !requests[0].some((old) => old.id === point.id))!.id
  const count = requests[1].length
  await expect(dialog.getByRole('button', { name: 'Früher', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Früher', exact: true }).click()
  await expect.poll(() => requests.length).toBe(3)
  expect(requests[2].findIndex((point) => point.id === addedId)).toBeLessThan(requests[1].findIndex((point) => point.id === addedId))
  await expect(dialog.getByRole('button', { name: 'Zwischenpunkt entfernen' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Zwischenpunkt entfernen' }).click()
  await expect.poll(() => requests.length).toBe(4)
  expect(requests[3]).toHaveLength(count - 1)
  await dialog.getByRole('button', { name: 'Schliessen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Wegpunkte', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click()
  await expect.poll(() => requests.length).toBe(5)
  expect(requests[4]).toHaveLength(count)
  await expect(name).toHaveValue('Meine Aare-Runde')
})

test('warnings reveal and focus the actual detail section', async ({ page }, info) => {
  await prepare(page)
  await page.locator('.route-warning-summary').click()
  const warnings = info.project.name === 'mobile' ? page.locator('.route-detail-dialog .route-warnings') : page.locator('.route-summary .route-warnings')
  await expect(warnings).toBeFocused()
  await expect(warnings).toBeInViewport()
  await expect(warnings.locator('li')).not.toHaveCount(0)
})

test('browser back closes workspace layers without losing the route', async ({ page }, info) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Route bearbeiten', exact: true }).click()
  await page.getByRole('button', { name: 'Wegpunkte', exact: true }).click()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Wegpunkte bearbeiten', exact: true })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Fertig', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Route bearbeiten', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toBeVisible()
  if (info.project.name === 'mobile') await page.locator('.mobile-saved-button').click()
  else await page.locator('.topbar nav').getByRole('button', { name: /Meine Routen/ }).click()
  await expect(page.getByRole('dialog', { name: 'Meine Routen', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Meine Routen', exact: true })).not.toBeVisible()
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Grosse Detailansicht neben der Karte' }).click()
    await expect(page.getByRole('dialog', { name: 'Alle Routendetails', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('dialog', { name: 'Alle Routendetails', exact: true })).not.toBeVisible()
  }
  await expect(page).toHaveURL('/')
})

test('short landscape planning has reachable inputs and a scrollable main action', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 390 })
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await page.goto('/')
  const search = page.getByRole('combobox', { name: 'Startort suchen' })
  await search.scrollIntoViewIfNeeded()
  await expect(search).toBeInViewport()
  await search.fill('Bern')
  await search.press('Escape')
  const button = page.getByRole('button', { name: 'Route planen', exact: true })
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeInViewport()
  await expect.poll(() => button.evaluate((element) => { const rect = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) })).toBe(true)
})

test('a keyboard-sized visual viewport keeps mobile renaming above the keyboard', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Mobile keyboard layout contract')
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { width: innerWidth, height: innerHeight, offsetTop: 0, scale: 1 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  })
  await prepare(page)
  await page.evaluate(() => { Object.assign(window.visualViewport!, { height: 430 }); window.visualViewport!.dispatchEvent(new Event('resize')) })
  const name = page.getByRole('textbox', { name: 'Routenname', exact: true })
  await name.fill('Aare am Morgen')
  await expect.poll(() => page.locator('.route-summary').evaluate((element) => { const rect = element.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= 430 })).toBe(true)
  await expect(name).toHaveValue('Aare am Morgen')
})
