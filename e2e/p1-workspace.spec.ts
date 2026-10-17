import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
})

test('search supports retry, keyboard selection, empty text and no-results feedback', async ({ page }) => {
  let fail = true
  await page.route('**/api/places/search?**', (route) => {
    if (fail) return route.fulfill({ status: 503, json: {} })
    const query = new URL(route.request().url()).searchParams.get('q')
    return route.fulfill({ json: { results: query === 'Nirgends' ? [] : [{ label: 'Basel, Schweiz', coordinate: [7.5886, 47.5596] }] } })
  })
  await page.goto('/')
  const search = page.getByRole('combobox', { name: 'Startort suchen' })
  await search.fill('Basel')
  await expect(page.getByText('Ortssuche nicht erreichbar.')).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Erneut versuchen' }).click()
  await expect(page.getByRole('option', { name: 'Basel, Schweiz' })).toBeVisible()
  await search.press('ArrowDown')
  await search.press('Enter')
  await expect(search).toHaveValue('Basel, Schweiz')
  await search.fill('')
  await expect(search).toHaveValue('')
  await search.fill('Nirgends')
  await expect(page.getByText('Keine Orte gefunden.', { exact: false })).toBeVisible()
  await search.press('Escape')
  await expect(search).toHaveAttribute('aria-expanded', 'false')
})

test('map controls remain reachable; complete details and dialog focus work on both layouts', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 667 })
  await page.goto('/')
  await page.getByLabel('GPX-Datei auswählen').setInputFiles('test-fixtures/bern-import.gpx')
  await page.getByRole('button', { name: 'Hinweis schliessen' }).click()
  const summary = page.getByRole('region', { name: 'Routenzusammenfassung' })
  await expect(summary).toBeVisible()
  await expect(summary.getByRole('slider')).toBeVisible()
  for (const name of ['Zoom in', 'Zoom out', 'Drag to rotate map, click to reset north']) {
    const control = page.getByRole('button', { name, exact: true })
    await expect.poll(() => control.evaluate((element) => { const rect = element.getBoundingClientRect(); return rect.top >= 0 && element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) })).toBe(true)
  }
  const dimensions = await summary.evaluate((element) => ({ scroll: element.scrollHeight, height: element.clientHeight, width: element.scrollWidth, clientWidth: element.clientWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.height + 1)
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.clientWidth + 1)
  await page.getByRole('button', { name: 'Grosse Detailansicht neben der Karte' }).click()
  if (testInfo.project.name === 'mobile') {
    const details = page.getByRole('dialog', { name: 'Alle Routendetails', exact: true })
    await expect(details.getByText('Datenkonfidenz')).toBeVisible()
    await expect(details.getByText('Nicht analysiert', { exact: true })).toBeVisible()
    await details.getByRole('button', { name: 'Schliessen', exact: true }).click()
  } else {
    await expect(page.locator('.planner-panel')).not.toBeVisible()
    await expect(summary.getByText('Datenkonfidenz')).toBeVisible()
  }
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  const login = page.getByRole('dialog', { name: 'Willkommen zurück', exact: true })
  await expect(login).toBeVisible()
  await login.getByRole('button', { name: 'Schliessen', exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  expect(await login.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(login).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeFocused()
})
