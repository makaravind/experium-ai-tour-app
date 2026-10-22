import { test, expect, type Page } from '@playwright/test'
import { FAKE_AUDIO_URL, mockPrecacheDataset, passLoadingGate, silentWav } from './gate-helpers'

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

  test('Try again after 404 recovers once the file is served', async ({ page, context }) => {
    test.setTimeout(60000)
    await mockPrecacheDataset(page, { seedCache: false })
    await page.route(FAKE_AUDIO_URL, (route) => route.fulfill({ status: 404, body: 'not found' }))

    await page.goto('/')
    await expect(page.getByText(ASSET_ERROR)).toBeVisible({ timeout: 25000 })

    // page.route stops intercepting this cross-origin URL after multiple 404s (Playwright quirk).
    // Clear all page-level handlers and use context.route so the 4th request is intercepted.
    await page.unroute(FAKE_AUDIO_URL)
    await context.route(FAKE_AUDIO_URL, (route) =>
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

// Cache save verification (#88). Blocked registration leaves `'serviceWorker' in navigator` true, so
// the gate gets 'timeout' (not 'unsupported') after the full 20s SW wait; same screen either way.
test.describe('No offline support (SW blocked)', () => {
  test.use({ serviceWorkers: 'block' })
  test.skip(!process.env.E2E_PROD, 'needs a production build (service worker is off in dev)')
  test.setTimeout(60000)

  const NO_SUPPORT = "This browser can't save the tour offline"

  test('shows the no-offline-support screen when the SW never controls', async ({ page }) => {
    await mockPrecacheDataset(page, { seedCache: false })
    await page.goto('/')
    await expect(page.getByText(NO_SUPPORT)).toBeVisible({ timeout: 25000 })
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  })

  test('Continue online reaches the app; reload in the same session skips the screen', async ({
    page,
  }) => {
    // Audio is never downloaded on this path, so no cache seeding is needed
    await mockPrecacheDataset(page, { seedCache: false })
    await page.goto('/')
    await expect(page.getByText(NO_SUPPORT)).toBeVisible({ timeout: 25000 })

    await page.getByRole('button', { name: 'Continue online' }).click()
    await passLoadingGate(page)

    // sessionStorage survives the reload: dataset reloads, straight to onboarding, no 20s wait
    await page.reload()
    await passLoadingGate(page)
    await expect(page.getByText(NO_SUPPORT)).toBeHidden()
  })
})

// Shift-reload leaves an active SW that never claims the page; the gate must ask it to (CLAIM).
test.describe('Shift-reload CLAIM recovery', () => {
  test.skip(!process.env.E2E_PROD, 'needs a production build (service worker is off in dev)')

  // fixme: CDP bypass can't leave the page uncontrolled in Chromium, so this fakes the controller and
  // never exercises the real clients.claim() in sw.ts. Verify the shift-reload manually in the field.
  test.fixme('uncontrolled page gains control via CLAIM instead of showing the browser screen', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'service worker control is only reliable in chromium')
    test.slow() // up to 20s SW wait on top of two precache runs

    // Audio is seeded on every load until the flag below flips, so the first run finishes without
    // a network download (SW-originated requests bypass page.route; example.test is unreachable)
    await mockPrecacheDataset(page, { seedCache: false })
    await page.addInitScript((url) => {
      if (sessionStorage.getItem('e2e-no-seed')) return
      void caches.open('audio-cache').then((c) => c.put(url, new Response('x', { status: 200 })))
    }, FAKE_AUDIO_URL)
    await page.goto('/')
    await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 30000 })
    await page.waitForFunction(() => navigator.serviceWorker.controller != null)

    // Open a gap: dataset stays in the store, audio is gone, so the next run needs SW control
    const removed = await page.evaluate(async () => {
      sessionStorage.setItem('e2e-no-seed', '1')
      const cache = await caches.open('audio-cache')
      const keys = await cache.keys()
      await Promise.all(keys.map((r) => cache.delete(r)))
      return keys.length
    })
    expect(removed).toBeGreaterThan(0)

    // Shift-reload: Chromium keeps `controller` set even with CDP bypass, so fake the uncontrolled
    // document: hide the controller until the page posts CLAIM, then reveal it + fire controllerchange.
    // (Covers the gate's CLAIM + controllerchange handling; the real clients.claim() isn't exercised.)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-shift-reload')) return
      const container = navigator.serviceWorker
      const real = Object.getOwnPropertyDescriptor(ServiceWorkerContainer.prototype, 'controller')!
      let claimed = false
      Object.defineProperty(container, 'controller', {
        get: () => (claimed ? real.get!.call(container) : null),
      })
      const post = ServiceWorker.prototype.postMessage
      ServiceWorker.prototype.postMessage = function (this: ServiceWorker, msg: unknown) {
        if ((msg as { type?: string } | null)?.type === 'CLAIM') {
          claimed = true
          container.dispatchEvent(new Event('controllerchange'))
        }
        return post.apply(this, arguments as unknown as [unknown])
      }
    })
    await page.evaluate(() => sessionStorage.setItem('e2e-shift-reload', '1'))
    await page.reload()

    // The gate posts CLAIM after its 1s grace; control arrives well inside the 20s wait, so the
    // browser screen never shows. (The re-download itself can't succeed: example.test is fake.)
    await page.waitForFunction(() => navigator.serviceWorker.controller != null, null, {
      timeout: 15000,
    })
    await expect(page.getByText("This browser can't save the tour offline")).toBeHidden()
  })
})

// Map tiles are part of the offline guarantee (#90): a second asset group, downloaded after audio.
test.describe('Map tiles in offline guarantee', () => {
  test.skip(!process.env.E2E_PROD, 'needs a production build (service worker is off in dev)')

  test('fresh gate caches park.pmtiles in map-tiles-cache', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'offline + service worker is only reliable in chromium')
    test.setTimeout(90000)

    // Fresh visitor: only on the first navigation
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e-seeded')) return
      sessionStorage.setItem('e2e-seeded', '1')
      localStorage.clear()
    })

    await page.goto('/')
    // The real 11.8MB map downloads during the gate
    await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 60000 })

    const mapCached = await page.evaluate(async () => {
      const keys = await (await caches.open('map-tiles-cache')).keys()
      return keys.some((r) => r.url.endsWith('/park.pmtiles'))
    })
    expect(mapCached).toBe(true)
  })

  // The SW fetches audio/map itself, so page.route can't intercept them (and the fake example.test
  // audio from mockPrecacheDataset is unreachable). Use the real dataset: one small mp3 + the real map.
  test('audio completes before map download starts', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'offline + service worker is only reliable in chromium')
    test.setTimeout(90000)

    const requestOrder: string[] = []
    page.on('request', (req) => {
      const { pathname } = new URL(req.url())
      if (pathname.endsWith('.mp3')) requestOrder.push('audio')
      if (pathname === '/park.pmtiles') requestOrder.push('map')
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 60000 })

    const firstMap = requestOrder.indexOf('map')
    expect(firstMap).toBeGreaterThanOrEqual(0)
    expect(requestOrder.indexOf('audio')).toBeGreaterThanOrEqual(0)
    expect(requestOrder.lastIndexOf('audio')).toBeLessThan(firstMap)
  })

  test('loading screen shows "Downloading map…" during the map step', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'offline + service worker is only reliable in chromium')
    test.setTimeout(90000)

    // Hold the page's map fetch so the map step lasts long enough to assert on
    await page.addInitScript(() => {
      const realFetch = window.fetch.bind(window)
      window.fetch = async (input, init) => {
        const url = input instanceof Request ? input.url : String(input)
        if (new URL(url, location.href).pathname === '/park.pmtiles') {
          await new Promise((r) => setTimeout(r, 4000))
        }
        return realFetch(input, init)
      }
    })

    await page.goto('/')
    await expect(page.getByText('Downloading map…')).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 60000 })
  })
})
