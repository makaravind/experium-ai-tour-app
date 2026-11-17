import { test, expect, type Page } from '@playwright/test'
import {
  FAKE_AUDIO_URL,
  FAKE_HI_AUDIO_URL,
  mockAmenities,
  mockPrecacheDataset,
  seedAudioCache,
  seedMapCache,
} from './gate-helpers'

const FACTS = [
  { fact: 'The baobab can store thousands of litres of water in its trunk.' },
  { fact: 'Some baobabs live for over a thousand years.' },
  { fact: 'Its fruit is rich in vitamin C.' },
]

/** Returning visitor with a complete EN cache and one exhibit carrying `facts`. */
async function seedVisitor(page: Page, facts: { fact: string }[]) {
  await mockPrecacheDataset(page, { facts })
  await mockAmenities(page, [])
  await seedAudioCache(page)
  await seedMapCache(page)
  await page.addInitScript(
    ({ en, hi, facts }) => {
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
                type: 'landmark',
                tier: 'free',
                facts,
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
    { en: FAKE_AUDIO_URL, hi: FAKE_HI_AUDIO_URL, facts }
  )
}

async function openPeek(page: Page) {
  await page.goto('/map?search=exhibits')
  await page.getByText('Baobab Forest').first().click()
  await expect(page.getByRole('button', { name: 'Listen' })).toBeVisible()
}

// The drag handle is a <button>; SheetSummary's thumb is a div[role=button] with the same label.
// AmenitySheet mounts its own handle after PreviewSheet's, so the exhibit sheet's is the first.
const handle = (page: Page) =>
  page
    .locator('button[aria-label="Expand to full view"], button[aria-label="Collapse details"]')
    .first()
const teaser = (page: Page) => page.getByTestId('about-teaser')

test.describe('About teaser in the exhibit peek', () => {
  test('shows the first facts in the peek; tap expands to the full About', async ({ page }) => {
    await seedVisitor(page, FACTS)
    await openPeek(page)

    await expect(teaser(page)).toBeVisible()
    await expect(teaser(page)).toContainText('About')
    await expect(teaser(page)).toContainText(FACTS[0].fact)
    await expect(handle(page)).toHaveAttribute('aria-expanded', 'false')

    await teaser(page).click()
    await expect(handle(page)).toHaveAttribute('aria-expanded', 'true')
    // The teaser hands off to the full section: every fact once, no duplicate list
    await expect(teaser(page)).toHaveCount(0)
    for (const { fact } of FACTS) await expect(page.getByText(fact)).toHaveCount(1)
  })

  test('collapsing returns to the same peek position with the teaser', async ({ page }) => {
    await seedVisitor(page, FACTS)
    await openPeek(page)
    await expect(teaser(page)).toBeVisible()
    // Let the slide-in settle before measuring
    await expect.poll(async () => (await handle(page).boundingBox())?.y).toBeGreaterThan(0)
    await page.waitForTimeout(600)
    const before = (await handle(page).boundingBox())!.y

    await teaser(page).click()
    await expect(handle(page)).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(handle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(teaser(page)).toBeVisible()
    await page.waitForTimeout(600)

    const after = (await handle(page).boundingBox())!.y
    expect(Math.abs(after - before)).toBeLessThan(2)
  })

  test('no facts: no teaser', async ({ page }) => {
    await seedVisitor(page, [])
    await openPeek(page)
    await expect(teaser(page)).toHaveCount(0)
  })
})
