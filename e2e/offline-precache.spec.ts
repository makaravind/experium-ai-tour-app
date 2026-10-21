import { test, expect, type Page } from '@playwright/test'
import { FAKE_AUDIO_URL, mockPrecacheDataset, silentWav } from './gate-helpers'

// "Baobab Forest" — the only active QR code seeded in Supabase (and its only published audio row,
// so the real upfront precache is a single small mp3 — no mocking needed)
const QR_CODE = 'baobab-forest'

// The service worker is disabled under `next dev`, so offline reloads only work against a
// production build: `npm run build && E2E_PROD=1 npx playwright test e2e/offline-precache.spec.ts`
test.describe('Offline after upfront precache', () => {
  test.skip(!process.env.E2E_PROD, 'needs a production build (service worker is off in dev)')

  test('fresh visitor precaches on load, then exhibit works offline', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'offline + service worker is only reliable in chromium')

    await page.route('/api/scan', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 3 }),
      })
    )

    // Fresh visitor: only on the first navigation, so the reloads below keep their state
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e-seeded')) return
      sessionStorage.setItem('e2e-seeded', '1')
      localStorage.removeItem('experium_onboarded')
      localStorage.removeItem('experium_user_info')
      localStorage.removeItem('experium-store')
    })

    await page.goto(`/s/${QR_CODE}`)

    // AppGate starts downloading the visitor's language straight away
    // Precache finishes -> gate hands off to onboarding; skip it
    await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 30000 })
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()

    // Audio really landed in Cache Storage
    const cachedAudio = await page.evaluate(async () =>
      (await (await caches.open('audio-cache')).keys()).map((r) => r.url)
    )
    expect(cachedAudio.some((u) => u.endsWith('.mp3'))).toBe(true)

    // The SW install cached the /s/ shell in pages-cache; this online reload refreshes it
    await page.reload()
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)

    await context.setOffline(true)
    await page.reload()

    // Cache Storage is authoritative: straight to content, no offline wall
    await expect(page.getByText('Connect to the internet')).toBeHidden()
    await expect(page.getByText('Baobab Forest')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()

    // Playing needs a usable audio src, served from the cache
    await page.getByRole('button', { name: /listen/i }).click()
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
    const src = await page.evaluate(() => document.querySelector('audio')?.src ?? '')
    expect(src).toMatch(/\.mp3$/)
    const status = await page.evaluate(async (u) => (await fetch(u)).status, src)
    expect(status).toBe(200)
  })

  test('offline cold open with a saved dataset but audio gaps reaches the map, not the blocker', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'offline + service worker is only reliable in chromium')

    // Online: the real precache saves the dataset to the store and the mp3 to Cache Storage
    await page.goto(`/s/${QR_CODE}`)
    await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 30000 })
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)

    // Open a gap: dataset stays in the store, audio is gone from Cache Storage
    const cachedAudio = await page.evaluate(async () => {
      const cache = await caches.open('audio-cache')
      const keys = await cache.keys()
      await Promise.all(keys.map((r) => cache.delete(r)))
      return keys.length
    })
    expect(cachedAudio).toBeGreaterThan(0)

    // setOffline only cuts the network: later documents still report navigator.onLine === true
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false })
    )
    await context.setOffline(true)
    await page.goto('/map')

    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('Connect to the internet')).toBeHidden()
  })
})

// Asset failure handling (#87): only 404/410 cap; mocked dataset so these run under `next dev` too.
// MAX_ATTEMPTS retries are back-to-back, so the capped screen appears within a run.
test.describe('Asset failure handling', () => {
  const ASSET_ERROR = "Some audio couldn't be downloaded"

  const persistedFailures = (page: Page) =>
    page.evaluate(() => {
      const raw = localStorage.getItem('experium-store')
      return raw ? (JSON.parse(raw).state?.assetFailures ?? {}) : null
    })

  test('500 on audio: connectivity stop, not counted in assetFailures', async ({ page }) => {
    await mockPrecacheDataset(page, { seedCache: false })
    await page.route(FAKE_AUDIO_URL, (route) => route.fulfill({ status: 500, body: 'error' }))

    await page.goto('/')
    await expect(page.getByText('Connect to the internet')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(ASSET_ERROR)).toBeHidden()

    const failures = await persistedFailures(page)
    expect(failures).not.toBeNull() // otherwise the empty check below is vacuous
    expect(Object.keys(failures)).toHaveLength(0)
  })

  test('404: asset-error once, Continue anyway survives reload, strip shows offline', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'offline events are only reliable in chromium')
    test.setTimeout(60000)
    await mockPrecacheDataset(page, { seedCache: false })
    await page.route(FAKE_AUDIO_URL, (route) => route.fulfill({ status: 404, body: 'not found' }))
    await page.route('/api/scan', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 1 }),
      })
    )

    await page.goto('/')
    await expect(page.getByText(ASSET_ERROR)).toBeVisible({ timeout: 25000 })
    await expect(page.getByText('Baobab Forest')).toBeVisible()

    await page.getByRole('button', { name: 'Continue anyway' }).click()
    await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 10000 })
    await expect(page.getByRole('link', { name: 'Scan Now' })).toBeVisible()

    // Same capped set after a fresh page load: straight to the app, no re-block
    await page.reload()
    await expect(page.getByRole('link', { name: 'Scan Now' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(ASSET_ERROR)).toBeHidden()

    // Online the file streams: no strip. Offline and uncached: strip.
    await page.goto('/s/baobab-forest')
    await page.getByRole('button', { name: /listen/i }).click()
    await expect(page.getByText('Needs internet to play')).toBeHidden()
    await context.setOffline(true)
    await expect(page.getByText('Needs internet to play')).toBeVisible({ timeout: 10000 })
  })

  test('Try again after 404 recovers once the file is served', async ({ page }) => {
    test.setTimeout(60000)
    await mockPrecacheDataset(page, { seedCache: false })
    await page.route(FAKE_AUDIO_URL, (route) => route.fulfill({ status: 404, body: 'not found' }))

    await page.goto('/')
    await expect(page.getByText(ASSET_ERROR)).toBeVisible({ timeout: 25000 })

    // Later routes win: serve the file now
    await page.route(FAKE_AUDIO_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() })
    )
    const refetched = page.waitForResponse(
      (r) => r.url() === FAKE_AUDIO_URL && r.status() === 200,
      { timeout: 15000 }
    )
    await page.getByRole('button', { name: 'Try again' }).click()
    await refetched // the capped URL was reset and fetched again

    const state = await page.evaluate(
      () => JSON.parse(localStorage.getItem('experium-store')!).state
    )
    expect(Object.keys(state.assetFailures ?? {})).toHaveLength(0)
    expect(state.acknowledgedCapped ?? []).toHaveLength(0)

    // Under `next dev` there's no service worker, so the fetched audio never reaches Cache Storage
    // and the gate can't clear (see gate-helpers.ts). Prod build only.
    if (process.env.E2E_PROD) {
      await expect(page.getByText(ASSET_ERROR)).toBeHidden({ timeout: 15000 })
      await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 15000 })
    }
  })
})
