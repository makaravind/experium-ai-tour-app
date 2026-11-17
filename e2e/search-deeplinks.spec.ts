import { test, expect, type Page } from '@playwright/test'
import {
  FAKE_AUDIO_URL,
  FAKE_HI_AUDIO_URL,
  mockAmenities,
  mockPrecacheDataset,
  seedAudioCache,
  seedMapCache,
} from './gate-helpers'

const WASHROOM = {
  id: 'e2e-washroom',
  name: 'Main Washroom',
  type: 'washroom',
  description: 'Near Gate 2',
  photos: [],
  gps_lat: 17.381282,
  gps_lng: 78.1916483,
  section: 'K',
}

/** Returning visitor with a complete EN cache: the gate passes and the map reads the stored dataset. */
async function seedVisitor(page: Page) {
  await seedAudioCache(page)
  await seedMapCache(page)
  await page.addInitScript(
    ({ en, hi, washroom }) => {
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
                code: 'baobab-forest',
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
            cachedAmenities: [washroom],
          },
          version: 8,
        })
      )
    },
    { en: FAKE_AUDIO_URL, hi: FAKE_HI_AUDIO_URL, washroom: WASHROOM }
  )
}

const exhibitSearch = (page: Page) => page.getByPlaceholder('Search exhibits')
const amenitySearch = (page: Page) => page.getByPlaceholder('Search amenities')

test.describe('Search deep links', () => {
  test.beforeEach(async ({ page }) => {
    await mockPrecacheDataset(page)
    await mockAmenities(page, [WASHROOM])
    await seedVisitor(page)
  })

  test('/map?search=must-visit opens overlay with Must Visit active', async ({ page }) => {
    await page.goto('/map?search=must-visit')
    await expect(exhibitSearch(page)).toBeVisible()
    await expect(
      page.locator('button[aria-pressed="true"]', { hasText: 'Must Visit' })
    ).toBeVisible()
  })

  test('/?search=amenities forwards to /map and opens amenity mode', async ({ page }) => {
    await page.goto('/?search=amenities')
    await expect(page).toHaveURL(/\/map\?search=amenities/)
    await expect(amenitySearch(page)).toBeVisible()
  })

  test('/map?search=exhibits opens plain exhibit search; closing drops the param', async ({
    page,
  }) => {
    await page.goto('/map?search=exhibits')
    await expect(exhibitSearch(page)).toBeVisible()
    await expect(
      page.locator('button[aria-pressed="true"]', { hasText: 'Must Visit' })
    ).toHaveCount(0)

    await page.getByRole('button', { name: 'Close search' }).click()
    await expect(exhibitSearch(page)).toBeHidden()
    await expect(page).toHaveURL(/\/map$/)

    // Refresh must not reopen it
    await page.reload()
    await expect(page.getByText('Search', { exact: true })).toBeVisible()
    await expect(exhibitSearch(page)).toBeHidden()
  })

  test('unknown value is ignored', async ({ page }) => {
    await page.goto('/map?search=bogus')
    await expect(page.getByText('Search', { exact: true })).toBeVisible()
    await expect(exhibitSearch(page)).toBeHidden()
    await expect(amenitySearch(page)).toBeHidden()
  })
})
