import { test, expect } from '@playwright/test'

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
