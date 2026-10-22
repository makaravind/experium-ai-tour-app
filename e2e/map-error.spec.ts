import { test, expect, type Page } from '@playwright/test'
import { mockPrecacheDataset } from './gate-helpers'

// Post-load map errors are intentionally ignored (ParkMap only reports fatal errors before `load`).
// They can't be triggered deterministically in e2e; covered by the step 4 DevTools check.

/** Returning visitor with complete caches: the gate passes and /map mounts ParkMap. */
async function seedVisitor(page: Page) {
  await page.addInitScript(() => {
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
          cachedExhibits: [],
          cachedAmenities: [],
        },
        version: 2,
      })
    )
  })
}

// Next's route announcer also has role=alert
const strip = (page: Page) => page.getByRole('alert').filter({ hasText: "Map couldn't load" })
const retry = (page: Page) => page.getByRole('button', { name: 'Retry' })

test.describe('Map error recovery', () => {
  test.beforeEach(async ({ page }) => {
    // mockPrecacheDataset seeds map-tiles-cache with valid bytes (gate passes) and registers a
    // page.route that also serves valid bytes. Override the network route after setup so ParkMap
    // reads invalid bytes → throws before `load` → shows "Map couldn't load" strip.
    await mockPrecacheDataset(page)
    await seedVisitor(page)
    await page.route('**/park.pmtiles', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: Buffer.from('x'),
      })
    )
  })

  test('startup failure shows strip; Retry remounts ParkMap', async ({ page }) => {
    let pmtilesRequests = 0
    page.on('request', (req) => {
      if (req.url().includes('park.pmtiles')) pmtilesRequests++
    })

    await page.goto('/map')
    await expect(strip(page)).toContainText("Map couldn't load")
    await expect(retry(page)).toBeVisible()

    const before = pmtilesRequests
    await retry(page).click()

    // Fresh ParkMap re-reads the (still invalid) bytes → fails again
    await expect(strip(page)).toContainText("Map couldn't load")
    expect(pmtilesRequests).toBeGreaterThan(before)
  })

  test('honest fallback renders no map canvas, GPS dot or pin', async ({ page }) => {
    await page.goto('/map')
    await expect(strip(page)).toContainText("Map couldn't load")

    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.locator('[data-selected="true"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Amenities' })).toBeHidden()
  })
})
