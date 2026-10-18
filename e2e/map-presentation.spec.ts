import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('velvetia.guide-seen.v1', 'true')
    localStorage.setItem('velvetia.theme.v1', 'light')
  })
})

test('theme switching preserves the map canvas and imported route; branding and planning control adapt', async ({ page }, testInfo) => {
  // A deterministic provider response: theme and route rendering must not depend
  // on a live tile server. Real Swisstopo tiles are also checked in visual QA.
  if (process.env.VELVETIA_LIVE_MAP !== '1') await page.route('**/styles/ch.swisstopo.lightbasemap.vt/style.json', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fafafa' } }] } }))
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const canvas = page.locator('.maplibregl-canvas')
  await expect(page.locator('.map-status')).toHaveCount(0)
  const original = await canvas.elementHandle()
  const logo = page.locator('.brand-signet')
  await expect(logo).toBeVisible()
  expect(await logo.getAttribute('src')).not.toContain('full')
  await expect(page.locator('.brand-wordmark')).toBeVisible({ visible: testInfo.project.name === 'desktop' })
  const toggle = page.getByRole('button', { name: 'Planungsmenü schliessen' })
  await expect(toggle).toHaveText('Planung')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.click()
  await expect(page.getByRole('button', { name: 'Planungsmenü öffnen' })).toHaveText('Planung')
  await page.getByRole('button', { name: 'Planungsmenü öffnen' }).click()
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  const name = page.getByRole('textbox', { name: 'Routenname', exact: true })
  await name.fill('Theme-Test')
  for (const theme of ['dark', 'light', 'dark']) {
    await page.getByRole('button', { name: theme === 'dark' ? 'Dunkles Design' : 'Helles Design' }).click()
    await expect(page.locator('.map-canvas')).toHaveAttribute('data-map-theme', theme)
    expect(await canvas.evaluate((element, previous) => element === previous, original)).toBe(true)
    await expect(name).toHaveValue('Theme-Test')
    expect(await canvas.evaluate((element) => getComputedStyle(element).cursor)).toContain('map-crosshair.svg')
    await page.screenshot({ path: testInfo.outputPath(`workspace-${theme}.png`), animations: 'disabled' })
  }
  await page.getByRole('button', { name: 'Route speichern', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Änderungen speichern', exact: true })).toBeVisible()
  if (testInfo.project.name === 'mobile') await page.locator('.mobile-saved-button').click()
  else await page.locator('.topbar nav').getByRole('button', { name: /Meine Routen/ }).click()
  const favorite = page.getByRole('button', { name: 'Favorit umschalten' })
  await expect(favorite).toHaveAttribute('aria-pressed', 'false')
  const styles = await favorite.evaluate((element) => { const css = getComputedStyle(element); return { background: css.backgroundColor, border: css.borderTopWidth, width: element.clientWidth, height: element.clientHeight } })
  expect(styles).toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px', width: 44, height: 44 })
  await favorite.click()
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Route löschen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Löschen bestätigen', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('library-dark.png') })
  expect(errors).toEqual([])
})

test('map loading and failure messages are readable and have no prose dashes', async ({ page }) => {
  let fail!: () => void
  const failure = new Promise<void>((resolve) => { fail = resolve })
  await page.route('**/styles/ch.swisstopo.lightbasemap.vt/style.json', async (route) => { await failure; await route.fulfill({ status: 503, body: 'Unavailable' }) })
  await page.goto('/')
  await expect(page.locator('.map-status')).toHaveText('Karte wird geladen')
  fail()
  await expect(page.locator('.map-status')).toHaveText('Karte nicht erreichbar. Prüfe deine Verbindung.')
})
