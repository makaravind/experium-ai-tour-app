import { test, expect, type Page } from '@playwright/test'
import {
  FAKE_AUDIO_URL,
  FAKE_HI_AUDIO_URL,
  mockPrecacheDataset,
  seedAudioCache,
  silentWav,
} from './gate-helpers'

const QR_CODE = 'baobab-forest'

type Lang = 'en' | 'hi' | 'te'

/** Returning visitor with a complete EN cache (v1 store) landing on the exhibit page. */
async function seedVisitor(
  page: Page,
  { language, precacheLanguage }: { language: Lang; precacheLanguage: Lang },
  { cacheEn = true } = {}
) {
  if (cacheEn) await seedAudioCache(page)
  await page.addInitScript(
    ({ en, hi, code, language, precacheLanguage, cacheEn }) => {
      localStorage.setItem('experium_onboarded', '1')
      localStorage.setItem(
        'experium-store',
        JSON.stringify({
          state: {
            language,
            visitedExhibits: [],
            totalDiscovered: 0,
            precacheLanguage,
            completionByGroup: { 'audio-cache': { language: precacheLanguage, complete: cacheEn } },
            cachedExhibits: [
              {
                id: 'e2e-baobab',
                code,
                status: 'active',
                name: 'Baobab Forest',
                type: null,
                tier: 'free',
                facts: [],
                audio: { en, hi },
              },
            ],
          },
          version: 1,
        })
      )
    },
    {
      en: FAKE_AUDIO_URL,
      hi: FAKE_HI_AUDIO_URL,
      code: QR_CODE,
      language,
      precacheLanguage,
      cacheEn,
    }
  )
}

/** Mocks /api/scan and returns the page-land hits (`listened: false`) so far. */
async function trackPageLandScans(page: Page) {
  const hits: unknown[] = []
  await page.route('/api/scan', async (route) => {
    const body = route.request().postDataJSON()
    if (body?.listened === false) hits.push(body)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total_discovered: 0 }),
    })
  })
  return hits
}

const chip = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Audio language' }).first().getByRole('button', { name })
// The sheet is still animating in right after Listen appears; a tap that lands mid-spring can be
// swallowed, and re-tapping the selected chip is a no-op.
const pickHindi = (page: Page) =>
  expect(async () => {
    await chip(page, 'हि').click()
    await expect(chip(page, 'हि')).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
  }).toPass()
const audioSrc = (page: Page) => page.evaluate(() => document.querySelector('audio')?.src ?? '')
const listen = (page: Page) => page.getByRole('button', { name: /listen/i })
const toast = (page: Page) => page.getByRole('status')

test.describe('Language switch from the sheet', () => {
  test.beforeEach(async ({ page }) => {
    // Cache Storage is seeded with EN only; HI is streamed (route per test)
    await mockPrecacheDataset(page)
  })

  test('HI chip: no loading screen, no second page-land scan', async ({ page }) => {
    const hits = await trackPageLandScans(page)
    await seedVisitor(page, { language: 'en', precacheLanguage: 'en' })
    await page.goto(`/s/${QR_CODE}`)

    await expect(listen(page)).toBeVisible({ timeout: 10000 })
    await expect(chip(page, 'EN')).toBeVisible()
    await expect(chip(page, 'हि')).toBeVisible()
    await expect.poll(() => hits.length).toBe(1)

    await pickHindi(page)

    await expect(page.getByText('Preparing your audio tour…')).toBeHidden()
    await expect(listen(page)).toBeVisible()
    // a remount of the exhibit page would re-fire the page-land scan
    await page.waitForTimeout(1500)
    expect(hits).toHaveLength(1)
  })

  test('HI fulfilled: Listen plays the HI src', async ({ page }) => {
    await trackPageLandScans(page)
    await page.route(FAKE_HI_AUDIO_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() })
    )
    await seedVisitor(page, { language: 'en', precacheLanguage: 'en' })
    await page.goto(`/s/${QR_CODE}`)
    await expect(listen(page)).toBeVisible({ timeout: 10000 })

    await pickHindi(page)
    await listen(page).click()

    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
    expect(await audioSrc(page)).toBe(FAKE_HI_AUDIO_URL)
    await expect(toast(page)).toBeHidden()
  })

  test('HI aborted: toast, EN chip selected, EN src', async ({ page }) => {
    await trackPageLandScans(page)
    await page.route(FAKE_HI_AUDIO_URL, (route) => route.abort('failed'))
    await seedVisitor(page, { language: 'en', precacheLanguage: 'en' })
    await page.goto(`/s/${QR_CODE}`)
    await expect(listen(page)).toBeVisible({ timeout: 10000 })

    await pickHindi(page)
    await listen(page).click()

    await expect(toast(page)).toHaveText('Hindi needs internet. Switched to English.')
    await expect(chip(page, 'EN')).toHaveAttribute('aria-pressed', 'true')
    expect(await audioSrc(page)).toBe(FAKE_AUDIO_URL)
  })

  test('HI never answered: reverts after the 8s start timeout', async ({ page }) => {
    await trackPageLandScans(page)
    await page.route(FAKE_HI_AUDIO_URL, () => {}) // hangs
    await seedVisitor(page, { language: 'en', precacheLanguage: 'en' })
    await page.goto(`/s/${QR_CODE}`)
    await expect(listen(page)).toBeVisible({ timeout: 10000 })

    await pickHindi(page)
    await listen(page).click()
    await expect(chip(page, 'हि')).toHaveAttribute('aria-pressed', 'true')
    await expect(toast(page)).toBeHidden()

    await expect(toast(page)).toHaveText('Hindi needs internet. Switched to English.', {
      timeout: 15000,
    })
    await expect(chip(page, 'EN')).toHaveAttribute('aria-pressed', 'true')
    expect(await audioSrc(page)).toBe(FAKE_AUDIO_URL)
  })

  test('language without audio: Listen reverts with "Not available"', async ({ page }) => {
    await trackPageLandScans(page)
    await seedVisitor(page, { language: 'te', precacheLanguage: 'en' })
    await page.goto(`/s/${QR_CODE}`)
    await expect(listen(page)).toBeVisible({ timeout: 10000 })

    await listen(page).click()

    await expect(toast(page)).toHaveText('Not available in Telugu. Switched to English.')
    await expect(chip(page, 'EN')).toHaveAttribute('aria-pressed', 'true')
    expect(await audioSrc(page)).toBe(FAKE_AUDIO_URL)
  })
})

test('catch-up run: picker re-targets the download to the tapped language', async ({ page }) => {
  await trackPageLandScans(page)
  // EN is not in Cache Storage, so the gate has to download it
  await mockPrecacheDataset(page, { seedCache: false })
  await seedVisitor(page, { language: 'hi', precacheLanguage: 'en' }, { cacheEn: false })

  // Hold EN so the loading screen stays up while the visitor taps Hindi
  let releaseEn!: () => void
  const enHeld = new Promise<void>((resolve) => (releaseEn = resolve))
  await page.route(FAKE_AUDIO_URL, async (route) => {
    await enHeld
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() })
  })
  const hiRequests: string[] = []
  await page.route(FAKE_HI_AUDIO_URL, (route) => {
    hiRequests.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() })
  })

  await page.goto(`/s/${QR_CODE}`)
  await expect(page.getByText('Choose your language')).toBeVisible({ timeout: 10000 })
  // highlights the precache language, not the playback language ('hi')
  await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(hiRequests).toHaveLength(0)

  await page.getByRole('button', { name: 'हिंदी' }).click()
  await expect(page.getByRole('button', { name: 'हिंदी' })).toHaveAttribute('aria-pressed', 'true')

  releaseEn()

  await expect.poll(() => hiRequests.length, { timeout: 15000 }).toBeGreaterThan(0)
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('experium-store') ?? '{}').state)
    )
    .toMatchObject({ precacheLanguage: 'hi' })
})
