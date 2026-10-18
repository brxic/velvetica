import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Only the dedicated local live-router QA server, never a production account.
const base = 'http://127.0.0.1:3028'
const output = new URL('../.data/routing-qa/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' })
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 412, height: 850 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1, isMobile: name === 'mobile', hasTouch: name === 'mobile' })
    const page = await context.newPage()
    await page.addInitScript(() => { localStorage.setItem('velvetia.guide-seen.v1', 'true'); localStorage.setItem('velvetia.theme.v1', 'dark') })
    // Fixed geocoding input; routing, elevation, attributes and map tiles are live.
    await page.route('**/api/places/search?**', (route) => route.fulfill({ json: { results: [{ label: 'Basel, Schweiz', coordinate: [7.5886, 47.5596] }] } }))
    await page.goto(base)
    await page.getByRole('combobox', { name: 'Startort suchen' }).fill('Basel')
    await page.getByRole('option', { name: 'Basel, Schweiz', exact: true }).click()
    const slider = page.getByRole('slider', { name: /Distanz/ })
    await slider.focus(); await slider.press('Home')
    for (let step = 0; step < 7; step++) await slider.press('ArrowRight')
    const response = page.waitForResponse((response) => response.url().endsWith('/api/routes/plan') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Route planen', exact: true }).click()
    const routed = await response
    if (routed.status() !== 201) throw new Error(`Live routing UI failed: ${routed.status()}`)
    const route = await routed.json()
    if (!route.provenance.routingEngine.startsWith('Valhalla') || route.metrics.confidence !== 'verified') throw new Error('Expected real local Valhalla route')
    await page.getByRole('textbox', { name: 'Routenname', exact: true }).waitFor({ state: 'visible' })
    await page.locator('[data-map-theme="dark"]').waitFor({ timeout: 30_000 })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: fileURLToPath(new URL(`live-${name}.png`, output)), fullPage: true })
    await writeFile(new URL(`live-${name}.json`, output), JSON.stringify({ provider: route.provenance.routingEngine, distanceKm: route.metrics.distanceKm, mapTheme: 'dark', viewport }, null, 2))
    console.log(`${name}: live route → elevation → rendered map/details; ${route.metrics.distanceKm} km`)
    await context.close()
  }
} finally { await browser.close() }
