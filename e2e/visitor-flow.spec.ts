import { test, expect } from '@playwright/test'
import {
  FAKE_AUDIO_URL,
  FAKE_HI_AUDIO_URL,
  mockPrecacheDataset,
  passLoadingGate,
  seedAudioCache,
  seedMapCache,
} from './gate-helpers'

// "Baobab Forest" — the only active QR code seeded in Supabase
const QR_CODE = 'baobab-forest'

test.describe('Visitor flow — golden path', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the scan API so we don't write test data to production DB. total_discovered stays at the
    // fresh-visitor 0 so no trail milestone card interrupts the sheet-collapse assertions.
    await page.route('/api/scan', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 0 }),
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

    // 2. Precache starts on its own; info modal appears once it completes
    await passLoadingGate(page)
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
    await passLoadingGate(page)
    await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 6000 })
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()

    // First play records the scan (listened: true) — arm the listener before clicking Listen
    const scanRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/api/scan') &&
        req.method() === 'POST' &&
        req.postDataJSON()?.listened === true
    )

    // Listen takes the sheet fullscreen and morphs the button into the ring player
    await page.getByRole('button', { name: /listen/i }).click()
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
    await expect(page.getByRole('button', { name: /listen/i })).toBeHidden()

    const body = (await scanRequest).postDataJSON()
    expect(body.visitorId).toBeTruthy()
    expect(body.code).toBe(QR_CODE)

    // Simulate audio ending — the sheet owns the only <audio> element
    await page.evaluate(() => {
      document.querySelector('audio')?.dispatchEvent(new Event('ended'))
    })

    // Sheet collapses back to peek, so Listen returns
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close' })).toBeHidden()
  })

  test('info modal — Continue saves user info and proceeds', async ({ page }) => {
    await passLoadingGate(page)
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
    await seedAudioCache(page)
    await seedMapCache(page)

    await page.addInitScript(
      ({ url, hiUrl, code }) => {
        localStorage.setItem('experium_onboarded', '1')
        localStorage.setItem(
          'experium-store',
          JSON.stringify({
            state: {
              language: 'en',
              visitedExhibits: [],
              totalDiscovered: 2,
              precacheLanguage: 'en',
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
                  audio: { en: url, hi: hiUrl },
                  gps_lat: 17.937484,
                  gps_lng: 78.460897,
                  exhibitStatus: 'live',
                },
              ],
            },
            version: 2,
          })
        )
      },
      { url: FAKE_AUDIO_URL, hiUrl: FAKE_HI_AUDIO_URL, code: QR_CODE }
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
