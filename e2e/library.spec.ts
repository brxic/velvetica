import { test, expect, type Page } from '@playwright/test'
import type { PlannedRoute, RouteVersion } from '../src/lib/domain'
import { defaultAccountPreferences } from '../src/lib/account-preferences'

async function openLibrary(page: Page) {
  if (await page.locator('.mobile-saved-button').isVisible()) await page.locator('.mobile-saved-button').click()
  else await page.locator('.topbar nav').getByRole('button', { name: /Meine Routen/ }).click()
}

test('cloud save → history restore → favorite filters → share and revoke', async ({ page }) => {
  const routes = new Map<string, PlannedRoute>()
  const versions: RouteVersion[] = []
  let shareActive = false
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await page.route('**/api/account/preferences', (route) => route.fulfill({ json: { preferences: defaultAccountPreferences } }))
  await page.route('**/api/account/home', (route) => route.fulfill({ json: { home: null } }))
  await page.route('**/api/saved-routes', (route) => route.fulfill({ json: { routes: [...routes.values()], authenticated: true, storageScope: 'cloud-test' } }))
  await page.route('**/api/saved-routes/**', async (request) => {
    const url = new URL(request.request().url())
    if (url.pathname.endsWith('/versions')) return request.fulfill({ json: { versions: [...versions].reverse() } })
    if (url.pathname.endsWith('/share')) {
      shareActive = request.request().method() === 'POST'
      return request.fulfill({ status: shareActive ? 200 : 204, ...(shareActive ? { json: { path: `/share/${'a'.repeat(43)}` } } : {}) })
    }
    const route = request.request().postDataJSON() as PlannedRoute
    const current = routes.get(route.id)
    if (current && route.serverVersion !== current.serverVersion) return request.fulfill({ status: 409, json: { code: 'VERSION_CONFLICT' } })
    const saved = { ...route, serverVersion: (current?.serverVersion ?? 0) + 1 }
    routes.set(saved.id, saved); versions.push({ route: structuredClone(saved), version: saved.serverVersion, savedAt: new Date().toISOString() })
    return request.fulfill({ json: { route: saved, authenticated: true, storageScope: 'cloud-test' } })
  })
  await page.goto('/')
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  const name = page.getByRole('textbox', { name: 'Routenname', exact: true })
  await name.fill('Originalrunde')
  await page.getByRole('button', { name: 'Route speichern', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Version 1')
  await name.fill('Neue Runde')
  await page.getByRole('button', { name: 'Änderungen speichern' }).click()
  await expect(page.getByRole('status')).toContainText('Version 2')
  await openLibrary(page)
  await page.getByRole('button', { name: 'Favorit umschalten' }).click()
  await page.getByRole('button', { name: 'Favoriten', exact: true }).click()
  await expect(page.getByRole('button', { name: /Neue Runde/ })).toBeVisible()
  await page.getByRole('button', { name: 'Versionsverlauf' }).click()
  await page.getByRole('button', { name: /v1.*wiederherstellen/ }).click()
  await expect(name).toHaveValue('Originalrunde')
  await expect(page.getByRole('status')).toContainText('als neue Version wiederhergestellt')
  await page.getByRole('button', { name: 'Teilen', exact: true }).click()
  await page.getByRole('button', { name: 'Freigabelink erstellen' }).click()
  await expect(page.getByLabel('Freigabelink', { exact: true })).toHaveValue(new RegExp('/share/'))
  expect(shareActive).toBe(true)
  await page.getByRole('button', { name: 'Alle Links für diese Route widerrufen' }).click()
  await expect(page.getByText('Alle bisherigen Links sind jetzt ungültig.')).toBeVisible()
  expect(shareActive).toBe(false)
})

test('a conflicting save keeps the edited route and offers an explicit copy', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await page.route('**/api/saved-routes/**', (route) => route.fulfill({ status: 409, json: { code: 'VERSION_CONFLICT' } }))
  await page.goto('/')
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  await page.getByRole('textbox', { name: 'Routenname', exact: true }).fill('Meine lokale Änderung')
  await page.getByRole('button', { name: 'Route speichern', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('auf einem anderen Gerät geändert')
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toHaveValue('Meine lokale Änderung')
  await expect(page.getByRole('button', { name: 'Als Kopie', exact: true })).toBeVisible()
})
