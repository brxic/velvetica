import { chromium } from '@playwright/test'
import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Requires the explicitly isolated `qa-server.mjs --supply` and a local POI import.
// Real OSM data and real local Valhalla. No production accounts or cloud writes.
const origin = 'http://127.0.0.1:3025'
const source = JSON.parse(await readFile(new URL('../.data/routing-qa/bern-city-one-way-city.json', import.meta.url), 'utf8'))
const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="Velvetia local QA" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Bern Versorgungstest</name><trkseg>${source.geometry.coordinates.map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"/>`).join('')}</trkseg></trk></gpx>`
const output = new URL('../.data/supply-qa/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 667 }], ['landscape', { width: 800, height: 390 }]]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: name !== 'desktop', hasTouch: name !== 'desktop' })
      const page = await context.newPage()
      page.on('pageerror', (error) => console.error('Browser error:', error.message))
      await page.addInitScript((theme) => { localStorage.setItem('velvetia.guide-seen.v1', 'true'); localStorage.setItem('velvetia.theme.v1', theme) }, theme)
      await page.goto(origin)
      await page.getByLabel('GPX-Datei auswählen').setInputFiles({ name: 'bern-supply-qa.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) })
      await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
      await page.getByRole('button', { name: 'Versorgung entlang der Route', exact: true }).click()
      const panel = page.getByRole('dialog', { name: 'Versorgung entlang der Route', exact: true })
      await panel.locator('.supply-list button').first().waitFor()
      await page.locator('.map-status').waitFor({ state: 'hidden' })
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: fileURLToPath(new URL(`${name}-${theme}-list.png`, output)) })
      // Try a small number of real places; unsuitable accesses remain rejected.
      const count = await panel.locator('.supply-list button').count()
      let acceptedPreview = false
      for (let index = 0; index < Math.min(count, 5); index++) {
        await panel.locator('.supply-list button').nth(index).click()
        await panel.getByRole('button', { name: 'Umweg berechnen', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('.supply-quote, .supply-detail .field-error'), { timeout: 60_000 })
        if (await panel.locator('.supply-quote').count()) {
          await panel.getByRole('button', { name: 'Stopp übernehmen' }).scrollIntoViewIfNeeded()
          await page.waitForLoadState('networkidle')
          await page.screenshot({ path: fileURLToPath(new URL(`${name}-${theme}-preview.png`, output)) })
          acceptedPreview = true
          break
        }
        await panel.getByRole('button', { name: 'Alle Treffer' }).click()
      }
      console.log(`${name}/${theme}: ${count} real places, rideable preview=${acceptedPreview}`)
      if (!acceptedPreview) throw new Error('No real stop preview passed the connection checks')
      await context.close()
    }
  }
} finally { await browser.close() }
