import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-pwa', timeout: 45_000, workers: 1, fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3027', serviceWorkers: 'allow', channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-pwa', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-pwa', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 667 } } },
  ],
  webServer: { command: 'node scripts/pwa-qa-server.mjs', url: 'http://127.0.0.1:3027/', timeout: 120_000, reuseExistingServer: false },
})
