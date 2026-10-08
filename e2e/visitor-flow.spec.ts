import { test, expect, type Page } from '@playwright/test'

// "Baobab Forest" — the only active QR code seeded in Supabase
const QR_CODE = 'baobab-forest'

// Audio URL used for the seeded returning-visitor cache. Never fetched: AppGate only compares keys.
const FAKE_AUDIO_URL = 'https://example.test/audio/baobab-forest-en.mp3'

/**
 * AppGate's bulk dataset query (lib/precache.ts fetchCachedExhibits) is the only browser-side
 * /rest/v1/exhibits call that selects `audio_url`. Mock it with one audio-less exhibit so the
 * precache finishes instantly with nothing to download, instead of fetching real audio.
 */
async function mockPrecacheDataset(page: Page) {
  await page.route('**/rest/v1/exhibits?*', async (route) => {
    if (!decodeURIComponent(route.request().url()).includes('audio_url')) return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'e2e-baobab',
          name: 'Baobab Forest',
          type: null,
          tier: 'free',
          facts: [],
          exhibit_qr_codes: [{ code: QR_CODE, status: 'active' }],
          exhibit_audio: [],
        },
      ]),
    })
  })
}

/** Fresh visitor: AppGate waits for a language tap before precache starts, then shows the info modal. */
async function passLanguageGate(page: Page) {
  await expect(page.getByText('Choose your language to begin')).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
}

test.describe('Visitor flow — golden path', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the scan API so we don't write test data to production DB
    await page.route('/api/scan', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 3 }),
      })
    })

    // Clear localStorage so onboarding always starts fresh
    await page.addInitScript(() => {
      localStorage.removeItem('experium_onboarded')
      localStorage.removeItem('experium_user_info')
      localStorage.removeItem('experium-store')
    })

    await mockPrecacheDataset(page)
    await page.goto(`/s/${QR_CODE}`)
  })

  test('loading screen → info modal → exhibit view', async ({ page }) => {
    // 1. Loading screen
    await expect(page.getByText('Experium Park')).toBeVisible()
    await expect(page.getByText('Choose your language to begin')).toBeVisible()

    // 2. Language tap starts precache; info modal appears once it completes
    await passLanguageGate(page)
    await expect(page.getByText('Personalize your experience')).toBeVisible({
      timeout: 6000,
    })

    // Skip the form — go straight to exhibit
    await page.getByRole('button', { name: 'Skip for now' }).click()

    // 3. Exhibit view: BottomSheet with exhibit name and Listen button
    await expect(page.getByText('Baobab Forest')).toBeVisible()
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
  })

  test('full golden path: listen → audio ends → scan recorded → sheet collapses', async ({
    page,
  }) => {
    // Fast-forward through loading + info modal
    await passLanguageGate(page)
    await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 6000 })
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()

    // Listen takes the sheet fullscreen and morphs the button into the ring player
    await page.getByRole('button', { name: /listen/i }).click()
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(page.getByRole('button', { name: /listen/i })).toBeHidden()

    // Reaching the end records the scan — arm the listener before dispatching
    const scanRequest = page.waitForRequest(
      (req) => req.url().includes('/api/scan') && req.method() === 'POST'
    )

    // Simulate audio ending — the sheet owns the only <audio> element
    await page.evaluate(() => {
      document.querySelector('audio')?.dispatchEvent(new Event('ended'))
    })

    const body = (await scanRequest).postDataJSON()
    expect(body.exhibitId).toBeTruthy()
    expect(body.qrCodeId).toBeTruthy()
    expect(typeof body.listenDurationSec).toBe('number')

    // Sheet collapses back to peek, so Listen returns
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close' })).toBeHidden()
  })

  test('info modal — Continue saves user info and proceeds', async ({ page }) => {
    await passLanguageGate(page)
    await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 6000 })

    await page.getByPlaceholder('Your name').fill('Test User')
    await page.getByRole('button', { name: 'Continue →' }).click()

    // Should reach exhibit view after submitting
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
  })
})

test.describe('Visitor flow — returning visitor', () => {
  test('skips loading + info modal when already onboarded', async ({ page }) => {
    // Cache Storage is authoritative: AppGate ignores `experium_onboarded` unless audio-cache holds
    // every URL in the stored dataset. Seed the flag, the persisted store (dataset + completion),
    // and the matching Cache Storage entry. Cache is seeded from a throwaway page first so it
    // exists before AppGate's mount check runs.
    await page.goto('/manifest.json')
    await page.evaluate(async (url) => {
      const cache = await caches.open('audio-cache')
      await cache.put(url, new Response('fake-audio', { status: 200 }))
    }, FAKE_AUDIO_URL)

    await page.addInitScript(
      ({ url, code }) => {
        localStorage.setItem('experium_onboarded', '1')
        localStorage.setItem(
          'experium-store',
          JSON.stringify({
            state: {
              language: 'en',
              visitedExhibits: [],
              totalDiscovered: 2,
              completionByGroup: { 'audio-cache': { language: 'en', complete: true } },
              cachedExhibits: [
                {
                  id: 'e2e-baobab',
                  code,
                  status: 'active',
                  name: 'Baobab Forest',
                  type: null,
                  tier: 'free',
                  facts: [],
                  audioUrl: url,
                },
              ],
            },
            version: 0,
          })
        )
      },
      { url: FAKE_AUDIO_URL, code: QR_CODE }
    )

    await page.route('/api/scan', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 3 }),
      })
    })

    await page.goto(`/s/${QR_CODE}`)

    // Returning visitor: skips both loading screen and info modal, goes straight to exhibit
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Preparing your audio tour…')).not.toBeVisible()
    await expect(page.getByText('Personalize your experience')).not.toBeVisible()
  })
})
