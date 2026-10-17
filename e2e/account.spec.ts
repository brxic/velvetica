import { test, expect, type BrowserContext } from '@playwright/test'
import { defaultAccountPreferences } from '../src/lib/account-preferences'

// Contract fixture for Supabase Auth. No email is sent and no real account is created.
// Real PostGIS ownership, concurrency and deletion live in integration/workspace.test.ts.
const user = { id: '8ecfb440-8797-47c3-bd55-f7fd1ab42d25', aud: 'authenticated', role: 'authenticated', email: 'rider@example.test', email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [] }
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated', iss: 'http://127.0.0.1:54329/auth/v1' })).toString('base64url')}.qa-signature`
const session = { access_token: token, refresh_token: 'qa-refresh', expires_in: 3600, token_type: 'bearer', user }

async function setupAuth(context: BrowserContext) {
  let defaults = { ...defaultAccountPreferences }
  let home: { label: string; coordinate: number[] } | null = { label: 'Basel, Schweiz', coordinate: [7.5886, 47.5596] }
  await context.addInitScript(() => localStorage.setItem('velvetia.guide-seen.v1', 'true'))
  await context.route('http://127.0.0.1:54329/**', async (route) => {
    const url = new URL(route.request().url())
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname.endsWith('/token')) return route.fulfill({ json: session, headers })
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user, headers })
    if (url.pathname.endsWith('/signup')) return route.fulfill({ json: { user }, headers })
    return route.fulfill({ json: {}, headers })
  })
  await context.route('**/api/saved-routes', (route) => route.fulfill({ json: { routes: [], storageScope: 'qa-account', authenticated: Boolean(route.request().headers().authorization) } }))
  await context.route('**/api/account/preferences', async (route) => {
    if (route.request().method() === 'PUT') defaults = route.request().postDataJSON()
    return route.fulfill({ json: { preferences: defaults } })
  })
  await context.route('**/api/account/home', async (route) => {
    if (route.request().method() === 'DELETE') home = null
    if (route.request().method() === 'PUT') home = route.request().postDataJSON()
    return route.fulfill({ json: { home } })
  })
}

test('email/password login → preferences → home → logout → login again', async ({ page, context }) => {
  await setupAuth(context)
  await page.goto('/')
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Willkommen zurück' })
  await dialog.getByLabel('E-Mail-Adresse').fill(user.email)
  await dialog.getByLabel('Passwort', { exact: true }).fill('test-password-only')
  await dialog.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dein Konto', exact: true })).toBeVisible()
  const profile = page.getByRole('combobox', { name: 'Fahrradtyp', exact: true })
  await expect(profile).toBeEnabled()
  await profile.selectOption('gravel')
  await page.getByLabel('Rundtour · km').fill('80')
  await page.getByRole('button', { name: 'Standards speichern' }).click()
  await expect(page.getByText('Standards gespeichert. Sie gelten für deine nächste Planung.')).toBeVisible()
  await page.getByRole('button', { name: 'Zuhause entfernen' }).click()
  await expect(page.getByText('Zuhause entfernt.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click()
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Willkommen zurück' })).toBeVisible()
  await page.getByLabel('E-Mail-Adresse').fill(user.email)
  await page.getByLabel('Passwort', { exact: true }).fill('test-password-only')
  await page.getByRole('dialog').getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dein Konto', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Fahrradtyp', exact: true })).toHaveValue('gravel')
})

test('registration and password reset show clear email confirmation state', async ({ page, context }) => {
  await setupAuth(context)
  await page.goto('/')
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()
  await page.getByLabel('E-Mail-Adresse').fill(user.email)
  await page.getByLabel('Passwort', { exact: true }).fill('test-password-only')
  await page.getByLabel('Passwort wiederholen').fill('test-password-only')
  await page.getByRole('dialog').getByRole('button', { name: 'Konto erstellen', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Bestätige jetzt deine E-Mail')
  await page.getByRole('button', { name: 'Bereits registriert? Anmelden' }).click()
  await page.getByRole('button', { name: 'Passwort vergessen?' }).click()
  await page.getByRole('button', { name: 'Reset-Link senden' }).click()
  await expect(page.getByRole('dialog')).toContainText('Falls ein Konto existiert, erhältst du jetzt eine E-Mail zum Zurücksetzen.')
})
