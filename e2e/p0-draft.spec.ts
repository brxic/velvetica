import { expect, test, type Page } from '@playwright/test'
import type { PlannedRoute } from '../src/lib/domain'
import { defaultAccountPreferences } from '../src/lib/account-preferences'

async function setup(page: Page) {
  let release = () => {}
  let hold = true
  let version = 0
  const submitted: PlannedRoute[] = []
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await page.route('**/api/account/preferences', (route) => route.fulfill({ json: { preferences: defaultAccountPreferences } }))
  await page.route('**/api/account/home', (route) => route.fulfill({ json: { home: null } }))
  await page.route('**/api/saved-routes', (route) => route.fulfill({ json: { routes: [], authenticated: true, storageScope: 'p0-test' } }))
  await page.route('**/api/saved-routes/**', async (request) => {
    const item = request.request().postDataJSON() as PlannedRoute
    submitted.push(item)
    if (hold) await new Promise<void>((resolve) => { release = resolve })
    version++
    await request.fulfill({ json: { route: { ...item, serverVersion: version }, authenticated: true, storageScope: 'p0-test' } })
  })
  await page.goto('/')
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  return { submitted, release: () => { hold = false; release() } }
}

test('late cloud acknowledgement preserves new edits and their next version token', async ({ page }) => {
  const cloud = await setup(page)
  const name = page.getByRole('textbox', { name: 'Routenname', exact: true })
  await name.fill('Submitted name')
  const pending = page.waitForRequest((request) => request.method() === 'PUT' && request.url().includes('/api/saved-routes/'))
  await page.getByRole('button', { name: 'Route speichern', exact: true }).click()
  await pending
  await name.fill('Edited during save')
  await page.getByRole('textbox', { name: 'Routenbeschreibung', exact: true }).fill('Keep this new description')
  cloud.release()
  await expect(page.getByRole('status')).toContainText('Version 1')
  await expect(name).toHaveValue('Edited during save')
  await expect(page.getByRole('textbox', { name: 'Routenbeschreibung', exact: true })).toHaveValue('Keep this new description')
  await expect(page.locator('.save-status')).toHaveText('Ungespeichert')
  expect(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented })).toBe(true)
  await page.getByRole('button', { name: 'Änderungen speichern' }).click()
  await expect(page.locator('.save-status')).toHaveText('Cloud synchronisiert')
  expect(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented })).toBe(false)
  expect(cloud.submitted[1]).toMatchObject({ name: 'Edited during save', description: 'Keep this new description', serverVersion: 1 })
})

test('discard protection can cancel reset and mode changes; late save cannot reopen a discarded draft', async ({ page }) => {
  const cloud = await setup(page)
  const name = page.getByRole('textbox', { name: 'Routenname', exact: true })
  await name.fill('Protected draft')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Velvetia Startseite' }).click()
  await expect(name).toHaveValue('Protected draft')
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  const menu = page.getByRole('button', { name: 'Planungsmenü öffnen' })
  if (await menu.isVisible()) await menu.click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Rundtour', exact: true }).click()
  await expect(name).toHaveValue('Protected draft')
  const close = page.getByRole('button', { name: 'Planungsmenü schliessen' })
  if (await close.isVisible()) await close.click()
  const pending = page.waitForRequest((request) => request.method() === 'PUT' && request.url().includes('/api/saved-routes/'))
  await page.getByRole('button', { name: 'Route speichern', exact: true }).click()
  await pending
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Velvetia Startseite' }).click()
  cloud.release()
  await expect(page.getByRole('status')).toContainText('Version 1')
  await expect(name).toHaveCount(0)
})

test('failed cloud and browser storage never report a secured route', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('velvetia.guide-seen.v1', 'true')
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { if (key.startsWith('velvetia.saved-routes')) throw new DOMException('Full', 'QuotaExceededError'); original.call(this, key, value) }
  })
  await page.route('**/api/saved-routes/**', (route) => route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } }))
  await page.goto('/')
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  await page.getByRole('button', { name: 'Route speichern', exact: true }).click()
  await expect(page.locator('.save-status')).toHaveText('Nicht gesichert')
  await expect(page.getByRole('status')).toContainText('Weder lokaler Speicher noch Cloud')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Velvetia Startseite' }).click()
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toBeVisible()
})
