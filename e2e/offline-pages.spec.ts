import { test, expect, type Page } from '@playwright/test'
import { FAKE_AUDIO_URL, seedAudioCache } from './gate-helpers'

const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Primary' })
// Screens render only once AppGate clears, so a visible marker means the app itself loaded
const homeScreen = (page: Page) => page.getByRole('link', { name: 'Scan Now' })
const mapScreen = (page: Page) => page.getByRole('button', { name: 'Search', exact: true })

const exhibitRow = (code: string, name: string) => ({
  id: `e2e-${code}`,
  name,
  type: null,
  tier: 'free',
  facts: [],
  exhibit_qr_codes: [{ code, status: 'active' }],
  exhibit_audio: [{ language: 'en', audio_url: FAKE_AUDIO_URL, status: 'published' }],
})

/** Opens `path` online, waits for the upfront precache and the service worker install. */
async function precacheFrom(page: Page, path: string) {
  await page.goto(path)
  await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 30000 })
  await page.evaluate(() => navigator.serviceWorker.ready)
}

/** setOffline only cuts the network: later documents still report navigator.onLine === true. */
async function goOffline(page: Page) {
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false })
  )
  await page.context().setOffline(true)
}

// Needs a production build (the service worker is off under `next dev`):
// `npm run build && E2E_PROD=1 npx playwright test e2e/offline-pages.spec.ts`
// Each test is a fresh visitor: Playwright gives it a new context with empty storage.
test.describe('Offline pages', () => {
  test.skip(!process.env.E2E_PROD, 'needs a production build (service worker is off in dev)')
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'offline + service worker is only reliable in chromium'
  )

  test.beforeEach(async ({ page }) => {
    await page.route('/api/scan', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 3 }),
      })
    )
  })

  test('Home-entry visitor: every route and any exhibit code open cold offline', async ({
    page,
  }) => {
    // The ticket-counter link: no exhibit is ever opened online
    await precacheFrom(page, '/')
    await expect(homeScreen(page)).toBeVisible()
    await goOffline(page)

    const routes = [
      ['/', homeScreen(page)],
      ['/map', mapScreen(page)],
      ['/scan', page.getByText('Scan Exhibit Marker')],
      ['/collection', page.getByRole('heading', { name: /cards collected/ })],
      ['/s/baobab-forest', page.getByText('Baobab Forest')],
      ['/s/not-a-real-code', page.getByText("Can't verify this code right now")],
    ] as const
    for (const [path, marker] of routes) {
      await page.goto(path)
      await expect(marker).toBeVisible({ timeout: 15000 })
    }
  })

  test('stale prefetch: offline tab taps still open their page', async ({ page }) => {
    await page.clock.install()
    await precacheFrom(page, '/')
    await expect(homeScreen(page)).toBeVisible()
    await goOffline(page)
    // Past Next's 5 min prefetch staleTime a tap refetches the page, fails, and falls back to a
    // full browser navigation
    await page.clock.fastForward('06:00')

    await tabBar(page).getByRole('link', { name: 'Map' }).click()
    await expect(page).toHaveURL('/map', { timeout: 15000 })
    await expect(mapScreen(page)).toBeVisible({ timeout: 15000 })

    await tabBar(page).getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL('/', { timeout: 15000 })
    await expect(homeScreen(page)).toBeVisible({ timeout: 15000 })
  })

  test('shared exhibit shell: offline /s/<B> shows B after only A was opened online', async ({
    page,
  }) => {
    // Two exhibits on the seeded audio URL (getAssetGroups dedupes it), so precache is instant
    await seedAudioCache(page)
    let datasetHits = 0
    await page.route('**/rest/v1/exhibits?*', (route) => {
      if (!decodeURIComponent(route.request().url()).includes('audio_url')) return route.fallback()
      datasetHits++
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          exhibitRow('baobab-forest', 'Baobab Forest'),
          exhibitRow('e2e-second', 'E2E Second'),
        ]),
      })
    })

    await precacheFrom(page, '/s/baobab-forest')
    expect(datasetHits).toBeGreaterThan(0)
    // The first load wasn't SW-controlled; reload online so the SW stores exhibit A's document
    await page.reload()
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()

    await goOffline(page)
    await page.goto('/s/e2e-second')
    await expect(page.getByText('E2E Second')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Baobab Forest')).toBeHidden()
  })
})
