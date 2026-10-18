import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Fixed isolated QA origin. No cloud data or production accounts.
const output = new URL(`../.data/workspace-qa/${process.argv.includes('--baseline') ? 'before' : 'after'}/`, import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })
try {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 412, height: 850 }], ['short-mobile', { width: 390, height: 667 }], ['landscape', { width: 800, height: 390 }]]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: device !== 'desktop', hasTouch: device !== 'desktop' })
      const page = await context.newPage()
      await page.addInitScript((theme) => { localStorage.setItem('velvetia.guide-seen.v1', 'true'); localStorage.setItem('velvetia.theme.v1', theme) }, theme)
      await page.goto('http://127.0.0.1:3025')
      await page.locator(`[data-map-theme="${theme}"]`).waitFor()
      await page.evaluate(() => document.fonts.ready)
      const shot = (state) => page.screenshot({ path: fileURLToPath(new URL(`${device}-${theme}-${state}.png`, output)), fullPage: true })
      await shot('planning')
      await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
      await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
      await page.getByRole('textbox', { name: 'Routenname', exact: true }).fill('Aare-Runde über die Altstadt und entlang des Flusses zurück nach Bern')
      await page.getByRole('textbox', { name: 'Routenname', exact: true }).blur()
      await shot('route')
      if (!process.argv.includes('--baseline')) {
        await page.getByRole('button', { name: 'Route bearbeiten', exact: true }).click()
        await shot('editing')
        await page.getByRole('button', { name: 'Wegpunkte', exact: true }).click()
        await shot('waypoints')
        await page.getByRole('dialog', { name: 'Wegpunkte bearbeiten', exact: true }).getByRole('button', { name: 'Schliessen', exact: true }).click()
        await page.getByRole('button', { name: 'Fertig', exact: true }).click()
      }
      await page.getByRole('button', { name: 'Route speichern', exact: true }).click()
      await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
      const library = page.locator('.mobile-saved-button')
      if (await library.isVisible()) await library.click()
      else await page.locator('.topbar nav').getByRole('button', { name: /Meine Routen/ }).click()
      await shot('library')
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
      await shot('account')
      await context.close()
    }
    console.log(`${device}: planning, route, library and account in both themes`)
  }
} finally { await browser.close() }
