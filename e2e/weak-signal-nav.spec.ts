import { test, expect, type Page } from '@playwright/test'
import { mockPrecacheDataset } from './gate-helpers'

const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Primary' })
// Screens render only once AppGate clears, so a visible marker means the app itself loaded
const homeScreen = (page: Page) => page.getByRole('link', { name: 'Scan Now' })
const mapScreen = (page: Page) => page.getByRole('button', { name: 'Search', exact: true })

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

/** Survives a client transition; a full document load wipes it. */
const plantMarker = (page: Page) =>
  page.evaluate(() => {
    ;(window as unknown as { __navMarker: boolean }).__navMarker = true
  })
const readMarker = (page: Page) =>
  page.evaluate(() => (window as unknown as { __navMarker?: boolean }).__navMarker)

// Needs a production build (the service worker is off under `next dev`):
// `E2E_PROD=1 npx playwright test e2e/weak-signal-nav.spec.ts`
// Scanner overlay is covered by __tests__/scan-opening-overlay.test.tsx (camera + jsQR mocked).
test.describe('Weak-signal navigation', () => {
  test.skip(!process.env.E2E_PROD, 'needs a production build (service worker is off in dev)')
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'offline + service worker is only reliable in chromium'
  )

  test.beforeEach(async ({ page }) => {
    await mockPrecacheDataset(page)
    await page.route('/api/scan', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 3 }),
      })
    )
  })

  test('hanging RSC: tab tap falls back to a full load of /map within 5s', async ({
    page,
    context,
  }) => {
    // context.route, not page.route: the SW's own network fetch is what must hang, and page.route
    // never sees requests the SW handles. Set before load so prefetches hang too (no router cache).
    await context.route(/[?&]_rsc=/, () => {}) // never answers
    await precacheFrom(page, '/')
    await expect(homeScreen(page)).toBeVisible()
    await plantMarker(page)

    await tabBar(page).getByRole('link', { name: 'Map' }).click()

    await expect(page).toHaveURL('/map', { timeout: 5000 })
    await expect(mapScreen(page)).toBeVisible({ timeout: 5000 })
    expect(await readMarker(page)).toBeUndefined()
  })

  test('6h staleTimes: offline tab tap is a client transition', async ({ page }) => {
    await page.clock.install()
    const mapPrefetch = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/map' && r.url().includes('_rsc=')
    )
    await precacheFrom(page, '/')
    await expect(homeScreen(page)).toBeVisible()
    await mapPrefetch

    await goOffline(page)
    // Past the old 5 min default, within 6h: the prefetched page is still reused without a request
    await page.clock.fastForward('05:00:00')
    await plantMarker(page)

    await tabBar(page).getByRole('link', { name: 'Map' }).click()

    await expect(page).toHaveURL('/map', { timeout: 5000 })
    await expect(mapScreen(page)).toBeVisible({ timeout: 5000 })
    expect(await readMarker(page)).toBe(true)
  })
})
