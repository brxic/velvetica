import { expect, test, type Page } from '@playwright/test'

test.skip(({ isMobile }) => !isMobile, 'Ride mode is available only on mobile layouts')

async function prepare(page: Page, denied = false) {
  await page.addInitScript(({ denied, theme }) => {
    localStorage.setItem('velvetia.guide-seen.v1', 'true')
    localStorage.setItem('velvetia.theme.v1', theme)
    const callbacks = new Map<number, PositionCallback>()
    let id = 0
    const position = () => ({ coords: { longitude: 7.4507, latitude: 46.9495, accuracy: 5, speed: 4 }, timestamp: Date.now() }) as GeolocationPosition
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(success: PositionCallback, error: PositionErrorCallback) {
        const next = ++id
        callbacks.set(next, success)
        if (denied) setTimeout(() => error({ code: 1 } as GeolocationPositionError), 10)
        else setTimeout(() => { if (callbacks.has(next)) success(position()) }, 20)
        return next
      },
      clearWatch(next: number) { callbacks.delete(next) },
    } })
    Object.defineProperty(window, '__rideQa', { value: { callbacks } })
  }, { denied, theme: process.env.VELVETIA_QA_THEME ?? 'light' })
  if (process.env.VELVETIA_LIVE_MAP !== '1') await page.route('**/styles/ch.swisstopo.lightbasemap.vt/style.json', (route) => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fafafa' } }] } }))
  await page.goto('/')
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  await page.getByRole('button', { name: 'Fahrmodus', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Fahrt vorbereiten', exact: true })
  await expect(dialog).toContainText('nicht an Velvetia übertragen')
  await dialog.getByRole('button', { name: 'Standort freigeben und starten' }).click()
}

test('ride mode follows GPS, pauses, handles off-route and cleans up without changing the route', async ({ page }, info) => {
  const errors: string[] = []
  const locationUploads: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/api/') && request.postData()?.includes('7.4507')) locationUploads.push(request.url()) })
  await prepare(page)
  const panel = page.getByRole('region', { name: 'Fahrtübersicht' })
  await expect(panel.getByRole('status')).toContainText('Auf der Route')
  await expect(page.getByRole('img', { name: 'Dein aktueller Standort' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).not.toBeVisible()
  await expect(panel.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByRole('button', { name: 'Fahrmodus beenden' })).toBeFocused()
  const viewport = page.viewportSize()!
  await page.mouse.move(viewport.width / 2, 180)
  await page.mouse.down(); await page.mouse.move(viewport.width / 2 + 55, 195, { steps: 8 }); await page.mouse.up()
  await expect(panel.getByRole('button', { name: 'Zentrieren' })).toBeVisible()
  await panel.getByRole('button', { name: 'Zentrieren' }).click()
  await expect(panel.getByRole('button', { name: 'Karte folgt' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Pausieren', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText('GPS pausiert')
  expect(await page.evaluate(() => (window as unknown as { __rideQa: { callbacks: Map<number, unknown> } }).__rideQa.callbacks.size)).toBe(0)
  await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Auf der Route')
  await page.evaluate(() => {
    const callbacks = (window as unknown as { __rideQa: { callbacks: Map<number, PositionCallback> } }).__rideQa.callbacks
    for (const callback of callbacks.values()) callback({ coords: { longitude: 7.4507, latitude: 46.951, accuracy: 5, speed: 4 }, timestamp: Date.now() + 1000 } as GeolocationPosition)
  })
  await expect(panel.getByRole('status')).toContainText('Abseits der Route')
  await expect.poll(async () => { const marker = await page.getByRole('img', { name: 'Dein aktueller Standort' }).boundingBox(); return Math.abs(marker!.x + marker!.width / 2 - page.viewportSize()!.width / 2) }).toBeLessThan(4)
  // At zoom 15, this known longitude difference projects to ~154 CSS pixels.
  // This catches an interrupted easeTo accidentally freezing at overview zoom.
  await expect.poll(async () => { const gps = await page.locator('.ride-location').boundingBox(); const start = await page.locator('.map-marker--start').boundingBox(); return Math.abs(gps!.x + gps!.width / 2 - start!.x - start!.width / 2) }).toBeCloseTo(153.8, 0)
  const dimensions = await panel.evaluate((element) => ({ height: element.clientHeight, scrollHeight: element.scrollHeight, width: element.clientWidth, scrollWidth: element.scrollWidth }))
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1)
  await page.screenshot({ path: info.outputPath('ride-mode.png') })
  await page.getByRole('button', { name: 'Fahrmodus beenden' }).click()
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toHaveValue('Bern Testfahrt')
  expect(await page.evaluate(() => (window as unknown as { __rideQa: { callbacks: Map<number, unknown> } }).__rideQa.callbacks.size)).toBe(0)
  expect(errors).toEqual([])
  expect(locationUploads).toEqual([])
  expect(await page.evaluate(() => Object.values(localStorage).join(''))).not.toContain('7.4507')
})

test('blocked GPS stays actionable and never claims route progress', async ({ page }) => {
  await prepare(page, true)
  const panel = page.getByRole('region', { name: 'Fahrtübersicht' })
  await expect(panel.getByRole('status')).toContainText('Standortzugriff blockiert')
  await expect(panel.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  await expect(panel.getByRole('button', { name: 'GPS erneut versuchen' })).toBeVisible()
  await page.getByRole('button', { name: 'Fahrmodus beenden' }).click()
  await expect(panel).not.toBeVisible()
})

test('switching to desktop ends the mobile ride and releases the location watcher', async ({ page }) => {
  await prepare(page)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __rideQa: { callbacks: Map<number, unknown> } }).__rideQa.callbacks.size)).toBe(1)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.getByRole('region', { name: 'Fahrtübersicht' })).not.toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __rideQa: { callbacks: Map<number, unknown> } }).__rideQa.callbacks.size)).toBe(0)
  await expect(page.getByRole('button', { name: 'Fahrmodus', exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Routenname', exact: true })).toHaveValue('Bern Testfahrt')
})

test('short landscape keeps GPS errors, exit and controls reachable', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 667, height: 375 } : { width: 1024, height: 600 })
  await prepare(page, true)
  const panel = page.getByRole('region', { name: 'Fahrtübersicht' })
  const bounds = await panel.boundingBox()
  const header = await page.locator('.ride-header').boundingBox()
  expect(bounds!.y).toBeGreaterThan(header!.y + header!.height + 4)
  for (const name of ['Fahrmodus beenden', 'GPS erneut versuchen', 'Pausieren']) {
    const button = page.getByRole('button', { name, exact: true })
    await expect.poll(() => button.evaluate((element) => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) })).toBe(true)
  }
})
