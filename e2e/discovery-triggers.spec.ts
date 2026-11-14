import { test, expect, type Page } from '@playwright/test'
import { FAKE_AUDIO_URL, mockPrecacheDataset, seedAudioCache, seedMapCache } from './gate-helpers'

const QR_CODE = 'baobab-forest'
const PAGE_URL = `/s/${QR_CODE}`
const EXHIBIT = { latitude: 17.3816, longitude: 78.1916283 }
// accuracy 18m is under the 40m ceiling; "far" is ~220m north of the exhibit
const NEAR = { ...EXHIBIT, accuracy: 18 }
const FAR = { latitude: EXHIBIT.latitude + 0.002, longitude: EXHIBIT.longitude, accuracy: 18 }

type Body = Record<string, unknown>
type PersistedStore = { discoveredByCampaign: Record<string, { codes: string[]; total: number }> }

/** Returning visitor (complete cache, 3 discoveries) so the gate passes and no handshake hits the DB. */
async function seedVisitor(page: Page) {
  await seedAudioCache(page)
  await seedMapCache(page)
  await page.addInitScript(
    ({ en, code }) => {
      if (localStorage.getItem('experium-store')) return
      localStorage.setItem('experium_onboarded', '1')
      localStorage.setItem('experium_visitor_id', 'e2e-visitor')
      localStorage.setItem(
        'experium-store',
        JSON.stringify({
          state: {
            language: 'en',
            visitorId: 'e2e-visitor',
            visitedExhibits: [],
            discoveredByCampaign: {
              default: { codes: ['other-1', 'other-2', 'other-3'], total: 3 },
            },
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
                facts: [{ fact: 'Test fact' }],
                audio: { en },
                gps_lat: 17.3816,
                gps_lng: 78.1916283,
                exhibitStatus: 'live',
                displayId: 'K1',
                photos: [],
              },
            ],
          },
          version: 9,
        })
      )
    },
    { en: FAKE_AUDIO_URL, code: QR_CODE }
  )
}

/** Answers every /api/scan and returns the bodies it received, in order. */
async function captureScans(page: Page) {
  const posts: Body[] = []
  await page.route('/api/scan', async (route) => {
    posts.push(route.request().postDataJSON())
    await route.fulfill({ status: 200, json: { total_discovered: 3 } })
  })
  return posts
}

const quartileBody = (posts: Body[], q: number) => posts.find((b) => b.listen_quartile === q)
const discoveredCodes = async (page: Page) =>
  (
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('experium-store') ?? '{}').state as PersistedStore
    )
  ).discoveredByCampaign.default.codes
const listen = (page: Page) => page.getByRole('button', { name: /listen/i })

/** Wait for the map's GPS watcher to publish a fix (the compass turns green once it follows). */
async function waitForFix(page: Page) {
  const compass = page
    .getByRole('button', { name: 'Home' })
    .locator('..')
    .getByRole('button')
    .last()
  await expect(compass).toHaveClass(/bg-ex-forest/, { timeout: 15000 })
}

/** Listen, then jump the sheet's <audio> to `pct`% (timeupdate crosses every quartile on the way). */
async function listenAndPlayTo(page: Page, pct: number) {
  await expect(listen(page)).toBeVisible({ timeout: 10000 })
  await waitForFix(page)
  await listen(page).click()
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.querySelector('audio')?.duration ?? 0))
    .toBeGreaterThan(0)
  await playTo(page, pct)
}

async function playTo(page: Page, pct: number) {
  await page.evaluate((pct) => {
    const el = document.querySelector('audio')!
    Object.defineProperty(el, 'currentTime', {
      configurable: true,
      get: () => (el.duration * pct) / 100,
      set: () => {},
    })
    el.dispatchEvent(new Event('timeupdate'))
  }, pct)
}

const endAudio = (page: Page) =>
  page.evaluate(() => document.querySelector('audio')?.dispatchEvent(new Event('ended')))

test.describe('Discovery triggers: listened near / audio complete', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrecacheDataset(page)
    await seedVisitor(page)
  })

  test.describe('near the exhibit', () => {
    test.use({ geolocation: NEAR, permissions: ['geolocation'] })

    test('50% discovers; position rides only the 50% POST; celebration waits for the end', async ({
      page,
    }) => {
      const posts = await captureScans(page)
      await page.goto(PAGE_URL)
      await listenAndPlayTo(page, 50)

      await expect.poll(() => posts.some((b) => b.listen_quartile === 50)).toBe(true)
      expect(await discoveredCodes(page)).toContain(QR_CODE)
      expect(quartileBody(posts, 50)).toMatchObject({
        lat: NEAR.latitude,
        lng: NEAR.longitude,
        accuracyM: 18,
      })
      for (const b of posts.filter((b) => b.listen_quartile !== 50)) {
        expect(b).not.toHaveProperty('lat')
        expect(b).not.toHaveProperty('accuracyM')
      }

      // 3 -> 4 crosses no milestone: the toast shows, but only after the audio ends
      await page.waitForTimeout(1000)
      await expect(page.getByText(/discovered/)).toBeHidden()
      await endAudio(page)
      await expect(page.getByText(/\+1 🌿 · 4\/50 discovered/)).toBeVisible()
    })
  })

  test.describe('far from the exhibit', () => {
    test.use({ geolocation: FAR, permissions: ['geolocation'] })

    test('50% does not discover (position is still sent for the server to judge)', async ({
      page,
    }) => {
      const posts = await captureScans(page)
      await page.goto(PAGE_URL)
      await listenAndPlayTo(page, 50)

      await expect.poll(() => posts.some((b) => b.listen_quartile === 50)).toBe(true)
      expect(quartileBody(posts, 50)).toMatchObject({ lat: FAR.latitude, accuracyM: 18 })
      expect(await discoveredCodes(page)).not.toContain(QR_CODE)
      await endAudio(page)
      await page.waitForTimeout(1500)
      await expect(page.getByText(/discovered/)).toBeHidden()
    })

    test('100% discovers anywhere', async ({ page }) => {
      const posts = await captureScans(page)
      await page.goto(PAGE_URL)
      await listenAndPlayTo(page, 100)

      await expect.poll(() => posts.some((b) => b.listen_quartile === 100)).toBe(true)
      expect(await discoveredCodes(page)).toContain(QR_CODE)
      await endAudio(page)
      await expect(page.getByText(/\+1 🌿 · 4\/50 discovered/)).toBeVisible()
    })
  })

  test.describe('from the map', () => {
    test.use({ geolocation: NEAR, permissions: ['geolocation'] })

    // A pin's sheet has no audio of its own: Listen opens /s/<code>?scansrc=app, which plays and reports.
    test('Listen on a map-selected exhibit sends first-play and progress POSTs', async ({
      page,
    }) => {
      const posts = await captureScans(page)
      await page.goto('/map')
      await waitForFix(page)
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.getByPlaceholder('Search exhibits').fill('Baobab')
      await page.getByRole('button', { name: /Baobab Forest/ }).click()
      await listen(page).click()
      await expect(page).toHaveURL(new RegExp(`${PAGE_URL}\\?scansrc=app`))

      await expect.poll(() => posts.some((b) => b.listened === true)).toBe(true)
      await expect
        .poll(() => page.evaluate(() => document.querySelector('audio')?.duration ?? 0))
        .toBeGreaterThan(0)
      await playTo(page, 50)

      await expect.poll(() => posts.some((b) => b.listen_quartile === 50)).toBe(true)
      expect(quartileBody(posts, 25)).toMatchObject({ code: QR_CODE, scan_src: 'app' })
      expect(quartileBody(posts, 50)).toMatchObject({ lat: NEAR.latitude, accuracyM: 18 })
      expect(await discoveredCodes(page)).toContain(QR_CODE)
    })
  })
})
