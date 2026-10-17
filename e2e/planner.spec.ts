import { test, expect, type Page } from '@playwright/test'

async function openPlanner(page: Page) {
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Wohin möchtest du fahren?' })).toBeVisible()
}

async function searchStart(page: Page) {
  await page.route('**/api/places/search?**', (route) => route.fulfill({ json: { results: [{ label: 'Basel, Schweiz', coordinate: [7.5886, 47.5596] }] } }))
  // Search's API shape is deliberately verified by choosing a rendered result.
  await page.getByRole('combobox', { name: 'Startort suchen' }).fill('Basel')
  await page.getByRole('option', { name: 'Basel, Schweiz', exact: true }).click()
}

test('GPX import → rename → local save → reopen → export; responsive details', async ({ page }, testInfo) => {
  await openPlanner(page)
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  const name = page.getByRole('textbox', { name: 'Routenname', exact: true })
  await expect(name).toBeVisible()
  await name.fill('Meine Aare-Runde')
  await page.getByRole('button', { name: 'Route speichern', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('auf diesem Gerät')
  const details = page.getByRole('region', { name: 'Routenzusammenfassung' })
  const dimensions = await details.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, height: el.getBoundingClientRect().height, screen: innerHeight }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1)
  expect(dimensions.height).toBeLessThan(dimensions.screen - 140)
  await page.getByRole('button', { name: 'Routendetails ausblenden' }).click()
  await expect(page.getByText('Höhenprofil & Steigung')).not.toBeVisible()
  await page.getByRole('button', { name: 'Routendetails einblenden' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'GPX exportieren', exact: true }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('meine-aare-runde.gpx')
  const mobileLibrary = page.locator('.mobile-saved-button')
  if (await mobileLibrary.isVisible()) await mobileLibrary.click()
  else await page.locator('.topbar nav').getByRole('button', { name: /Meine Routen/ }).click()
  await page.getByRole('button', { name: /Meine Aare-Runde/ }).click()
  await expect(name).toHaveValue('Meine Aare-Runde')
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  await page.screenshot({ path: `test-results/velvetia-${testInfo.project.name}.png`, fullPage: true })
})

test('one-way hides distance; planning failure keeps input and offers a retry', async ({ page }) => {
  await openPlanner(page)
  await page.getByRole('button', { name: 'One-Way', exact: true }).click()
  await expect(page.getByRole('slider', { name: /Distanz/ })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Zielort suchen' })).toBeVisible()
  await page.getByRole('button', { name: 'Rundtour', exact: true }).click()
  await searchStart(page)
  await page.getByRole('button', { name: 'Route planen', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toBeVisible()
  const toggle = page.getByRole('button', { name: 'Planungsmenü öffnen' })
  if (await toggle.isVisible()) await toggle.click()
  await page.route('**/api/routes/plan', (route) => route.fulfill({ status: 422, json: { code: 'ROUTE_FAILED' } }))
  await page.getByRole('button', { name: 'Route planen', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Entwurf verwerfen' }).click()
  await expect(page.getByRole('status')).toContainText('nicht berechnet')
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toBeVisible()
})

test('library filters, keyboard dismissal and theme survive reload', async ({ page }) => {
  await openPlanner(page)
  await page.getByRole('button', { name: 'Dunkles Design' }).click()
  await page.reload()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/)
  const library = page.getByRole('button', { name: 'Meine Routen', exact: true }).last()
  if (await library.isVisible()) await library.click()
  else await page.locator('.topbar nav').getByRole('button', { name: /Meine Routen/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Meine Routen' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Deine nächste Tour beginnt hier.' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('malformed GPX is rejected with a readable message', async ({ page }) => {
  await openPlanner(page)
  await page.getByLabel('GPX-Datei auswählen').setInputFiles({ name: 'unsafe.gpx', mimeType: 'application/xml', buffer: Buffer.from('<!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///etc/passwd">]><gpx>&x;</gpx>') })
  await expect(page.getByRole('status')).toContainText('XML-Deklarationen')
})
