import { test, expect, type Page } from '@playwright/test'
import {
  FAKE_AUDIO_URL,
  FAKE_HI_AUDIO_URL,
  mockAmenities,
  mockPrecacheDataset,
  seedAudioCache,
  seedMapCache,
} from './gate-helpers'

const QR_CODE = 'baobab-forest'
// ≈ 37 m from Baobab Forest (17.3816, 78.1916283)
const WASHROOM = {
  id: 'e2e-washroom',
  name: 'Main Washroom',
  type: 'washroom',
  description: 'Near Gate 2 · Token ₹5',
  photos: [],
  gps_lat: 17.381282,
  gps_lng: 78.1916483,
}
const DESCRIPTION = 'Near Gate 2 · Token ₹5'

/** Returning visitor with a complete EN cache: the gate passes and the map reads the stored dataset. */
async function seedVisitor(page: Page) {
  await seedAudioCache(page)
  await seedMapCache(page)
  await page.addInitScript(
    ({ en, hi, code, washroom }) => {
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
            totalDiscovered: 0,
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
                audio: { en, hi },
                gps_lat: 17.3816,
                gps_lng: 78.1916283,
                exhibitStatus: 'live',
              },
            ],
            cachedAmenities: [washroom],
          },
          version: 2,
        })
      )
    },
    { en: FAKE_AUDIO_URL, hi: FAKE_HI_AUDIO_URL, code: QR_CODE, washroom: WASHROOM }
  )
}

const chip = (page: Page) => page.getByRole('button', { name: WASHROOM.name })
// PreviewSheet's handle is in the DOM too; filter to elements with aria-expanded so we never
// accidentally target SheetSummary's <div role="button"> which lacks that attribute.
const amenityHandle = (page: Page) =>
  page
    .getByRole('button', { name: /Expand to full view|Collapse details/ })
    .and(page.locator('[aria-expanded]'))
    .last()
// Retries: while the expanded sheet is still sliding down, the tap lands on it instead of the scrim
const scrimTap = (page: Page) =>
  expect(async () => {
    await page.mouse.click(30, 300)
    await expect(page.getByText(DESCRIPTION)).toBeHidden({ timeout: 1000 })
  }).toPass()

test.describe('Amenities', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrecacheDataset(page)
    await mockAmenities(page, [WASHROOM])
    await seedVisitor(page)
  })

  test('chip → peek → expand → ✕ → scrim close', async ({ page }) => {
    await page.goto('/map')
    await chip(page).click()

    // Ring, peek content; no GPS fix so the badge has no distance
    await expect(page.locator('[data-selected="true"]')).toBeVisible()
    await expect(page.getByText(DESCRIPTION)).toBeVisible()
    await expect(page.getByText('Washroom', { exact: true })).toBeVisible()

    await amenityHandle(page).click()
    await expect(amenityHandle(page)).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(amenityHandle(page)).toHaveAttribute('aria-expanded', 'false')

    await scrimTap(page)
    await expect(page.locator('[data-selected="true"]')).toBeHidden()
  })

  test('pill → overlay amenity mode → row → peek', async ({ page }) => {
    await page.goto('/map')
    await page.getByRole('button', { name: 'Amenities' }).click()
    await expect(page.getByPlaceholder('Search amenities')).toBeVisible()
    await expect(page.getByText('All amenities · 1 places')).toBeVisible()
    await expect(page.getByText('Baobab Forest')).toBeHidden()

    // The map's chip shares the accessible name; the overlay renders after the map
    await page
      .getByRole('button', { name: /Main Washroom/ })
      .last()
      .click()
    await expect(page.getByPlaceholder('Search amenities')).toBeHidden()
    await expect(page.getByText(DESCRIPTION)).toBeVisible()
    await expect(page.locator('[data-selected="true"]')).toBeVisible()
  })

  test('pill with a chip selected opens amenity search and keeps the selection', async ({
    page,
  }) => {
    await page.goto('/map')
    await chip(page).click()
    await expect(page.getByText(DESCRIPTION)).toBeVisible()

    // The scrim must not swallow the tap
    await page.getByRole('button', { name: 'Amenities' }).click()
    await expect(page.getByPlaceholder('Search amenities')).toBeVisible()

    await page.getByPlaceholder('Search amenities').fill('wash')
    // Overlay's pill renders after the layout's; ✕ returns to exhibits mode and clears the query
    await page.getByRole('button', { name: 'Amenities' }).last().click()
    await expect(page.getByPlaceholder('Search exhibits')).toHaveValue('')
    await expect(page.getByText('Baobab Forest')).toBeVisible()
    await page.getByRole('button', { name: 'Close search' }).click()
    await expect(page.getByText(DESCRIPTION)).toBeVisible()
    await expect(page.locator('[data-selected="true"]')).toBeVisible()
  })

  test('map failure hides chips, pill and sheet; search still lists exhibits', async ({ page }) => {
    // beforeEach seeds valid pmtiles; override here with invalid bytes to trigger map failure.
    await seedMapCache(page, 'not-pmtiles')
    await page.goto('/map')
    await expect(page.getByRole('button', { name: 'Amenities' })).toBeHidden()
    await expect(chip(page)).toBeHidden()

    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByText('Baobab Forest')).toBeVisible()
  })

  test('exhibit-page entry clears a selected amenity', async ({ page }) => {
    await page.goto('/map')
    await chip(page).click()
    await expect(page.getByText(DESCRIPTION)).toBeVisible()

    // Client-side navigation, as a QR scan does
    await page.evaluate((code) => (window as any).next.router.push(`/s/${code}`), QR_CODE)
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(DESCRIPTION)).toBeHidden()

    await expect(async () => {
      await page.mouse.click(30, 300)
      await expect(page).toHaveURL(/\/map$/, { timeout: 1000 })
    }).toPass()
    await expect(chip(page)).toBeVisible()
    await expect(page.locator('[data-selected="true"]')).toBeHidden()
  })

  test.describe('with a GPS fix at Baobab Forest', () => {
    test.use({
      geolocation: { latitude: 17.3816, longitude: 78.1916283 },
      permissions: ['geolocation'],
    })

    test('chip tap leaves GPS follow mode and is keyboard operable', async ({ page }) => {
      await page.goto('/map')
      const compass = page
        .getByRole('button', { name: 'Home' })
        .locator('..')
        .getByRole('button')
        .last()
      await expect(compass).toHaveClass(/bg-ex-forest/, { timeout: 15000 })

      await chip(page).focus()
      await expect(chip(page)).toHaveAttribute('aria-pressed', 'false')
      await page.keyboard.press('Enter')
      await expect(chip(page)).toHaveAttribute('aria-pressed', 'true')
      await expect(compass).not.toHaveClass(/bg-ex-forest/)
    })

    test('badge shows distance; exhibit pin after an amenity leaves one sheet', async ({
      page,
    }) => {
      await page.goto('/map')
      await chip(page).click()
      await expect(page.getByText(/^Washroom · \d+m away$/)).toBeVisible()
      await expect(page.getByText(DESCRIPTION)).toBeVisible()

      await scrimTap(page)

      // Selecting the chip flew the map to it; recentre on the user (at the pin). The pin's hit
      // target sits just above the map centre
      await page
        .getByRole('button', { name: 'Home' })
        .locator('..')
        .getByRole('button')
        .last()
        .click()
      const { width, height } = page.viewportSize()!
      await expect
        .poll(async () => {
          const box = await page.locator('.you-dot').boundingBox()
          return box ? Math.abs(box.x + box.width / 2 - width / 2) < 2 : false
        })
        .toBe(true)
      await expect(async () => {
        await page.mouse.click(width / 2, height / 2 - 21)
        await expect(page.getByText('Baobab Forest')).toBeVisible({ timeout: 500 })
      }).toPass()
      await expect(page.getByText(DESCRIPTION)).toBeHidden()
      await expect(page.locator('[data-selected="true"]')).toBeHidden()
    })
  })

  test('chip is hidden on the exhibit page, back on the map', async ({ page }) => {
    await page.goto(`/s/${QR_CODE}`)
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible({ timeout: 10000 })
    await expect(chip(page)).toBeHidden()

    // A map tap leaves the exhibit page
    await expect(async () => {
      await page.mouse.click(30, 300)
      await expect(page).toHaveURL(/\/map$/, { timeout: 1000 })
    }).toPass()
    await expect(chip(page)).toBeVisible()
  })
})

// Needs a production build (the service worker is off under `next dev`):
// `E2E_PROD=1 npx playwright test e2e/amenities.spec.ts`
test.describe('Amenities offline', () => {
  test.skip(!process.env.E2E_PROD, 'needs a production build (service worker is off in dev)')
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'offline + service worker is only reliable in chromium'
  )

  test('cold open offline: chips and search still work', async ({ page }) => {
    await mockPrecacheDataset(page)
    await mockAmenities(page, [WASHROOM])
    await page.route('/api/scan', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_discovered: 3 }),
      })
    )

    await page.goto('/map')
    await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 30000 })
    await expect(chip(page)).toBeVisible({ timeout: 15000 })
    await page.evaluate(() => navigator.serviceWorker.ready)

    // setOffline only cuts the network: later documents still report navigator.onLine === true
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false })
    )
    await page.context().setOffline(true)
    await page.goto('/map')

    await expect(chip(page)).toBeVisible({ timeout: 15000 })
    await chip(page).click()
    await expect(page.getByText(DESCRIPTION)).toBeVisible()
    await scrimTap(page)

    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByText('Baobab Forest')).toBeVisible()
  })
})
