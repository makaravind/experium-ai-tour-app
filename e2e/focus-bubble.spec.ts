import { test, expect, type Page } from '@playwright/test'
import {
  FAKE_AUDIO_URL,
  FAKE_HI_AUDIO_URL,
  mockPrecacheDataset,
  seedAudioCache,
  seedMapCache,
} from './gate-helpers'

const QR_CODE = 'baobab-forest'

/** Returning visitor with a complete EN cache: the gate passes and the map reads the stored dataset. */
async function seedVisitor(page: Page) {
  await seedAudioCache(page)
  await seedMapCache(page)
  await page.addInitScript(
    ({ en, hi, code }) => {
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
                facts: [{ fact: 'Test fact' }],
                audio: { en, hi },
                gps_lat: 17.3816,
                gps_lng: 78.1916283,
                exhibitStatus: 'live',
                displayId: 'K1',
                photos: [],
              },
            ],
            cachedAmenities: [],
          },
          version: 8,
        })
      )
    },
    { en: FAKE_AUDIO_URL, hi: FAKE_HI_AUDIO_URL, code: QR_CODE }
  )
}

const bubble = (page: Page) => page.locator('[data-testid="focus-bubble"]')

test.describe('Focus bubble (map)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrecacheDataset(page)
    await seedVisitor(page)
  })

  // Pan the map so the K1 pin lands near the screen centre (pin starts ~200 px above it on Pixel 7).
  async function dragPinToCentre(page: Page) {
    await page.mouse.move(200, 500)
    await page.mouse.down()
    await page.mouse.move(200, 600, { steps: 6 })
    await page.mouse.move(200, 703, { steps: 6 })
    await page.mouse.up()
  }

  test('settle shows it, pan hides it, tap opens the sheet, closing the sheet brings it back', async ({
    page,
  }) => {
    await page.goto('/map')
    await expect(page.locator('canvas').first()).toBeVisible()
    await page.waitForTimeout(1500)
    // Pin is outside the pick radius on load
    await expect(bubble(page)).toHaveCount(0)

    await dragPinToCentre(page)
    await expect(bubble(page)).toBeVisible({ timeout: 2000 })
    await expect(bubble(page)).toHaveCSS('opacity', '1')
    await expect(bubble(page)).toContainText('Baobab Forest')
    await expect(bubble(page)).toContainText('Not visited')
    await expect(bubble(page)).toContainText('K1')

    // Next pan start hides it (and it stops taking taps)
    await page.mouse.move(200, 300)
    await page.mouse.down()
    await page.mouse.move(200, 310, { steps: 3 })
    await expect(bubble(page)).toHaveCSS('opacity', '0', { timeout: 1000 })
    await expect(bubble(page)).toHaveCSS('pointer-events', 'none')
    await page.mouse.up()
    // ... and it comes back after settling (pin still inside the radius)
    await expect(bubble(page)).toHaveCSS('opacity', '1', { timeout: 2000 })

    // Tap the bubble: sheet opens, map click handler must not close it
    await bubble(page).getByRole('button').click()
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
    // The map's own click handler must not have closed the sheet
    await page.waitForTimeout(600)
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
    // Suppressed while the sheet is open
    await expect(bubble(page)).toHaveCSS('opacity', '0')

    // Close the sheet via a map tap: the camera did not move, so the bubble must re-pick by itself
    await page.mouse.click(30, 300)
    await expect(bubble(page)).toHaveCSS('opacity', '1', { timeout: 2000 })
  })
})
