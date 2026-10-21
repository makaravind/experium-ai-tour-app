import { test, expect } from '@playwright/test'
import { FAKE_AUDIO_URL, mockPrecacheDataset } from './gate-helpers'

// App timeouts (lib/timeouts.ts): dataset 15s, audio idle 15s, handshake 10s.
// Routes below are intentionally never fulfilled so the request hangs until the app aborts it.

test('dataset timeout: shows Weak connection screen', async ({ page }) => {
  test.setTimeout(30000)
  await page.route('**/rest/v1/exhibits?*', () => {})
  await page.route('**/rest/v1/amenities?*', () => {})

  await page.goto('/')
  await expect(page.getByText('Weak connection')).toBeVisible({ timeout: 20000 })
})

test('audio timeout: shows Weak connection, no failures counted; Try again passes', async ({
  page,
}) => {
  test.setTimeout(45000)
  await mockPrecacheDataset(page, { seedCache: false }) // dataset OK, audio hangs
  await page.route('**/*.mp3', () => {}) // registered after the mock, so it takes precedence

  await page.goto('/')
  await expect(page.getByText('Weak connection')).toBeVisible({ timeout: 20000 })

  // a timeout must not count as an asset failure
  const persisted = await page.evaluate(() => localStorage.getItem('experium-store'))
  expect(persisted).not.toBeNull() // otherwise the empty-failures check below is vacuous
  const failures = JSON.parse(persisted!).state?.assetFailures ?? {}
  expect(Object.keys(failures)).toHaveLength(0)

  // audio is now cached; with dataset + audio complete the gate clears straight to the app (no info modal)
  await page.unroute('**/*.mp3')
  await page.evaluate(async (url) => {
    const c = await caches.open('audio-cache')
    await c.put(url, new Response('fake-audio', { status: 200 }))
  }, FAKE_AUDIO_URL)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Weak connection')).toBeHidden({ timeout: 15000 })
  await expect(page.getByRole('link', { name: 'Scan Now' })).toBeVisible()
})

test('handshake timeout: shows Weak connection screen', async ({ page }) => {
  test.setTimeout(30000)
  await mockPrecacheDataset(page) // dataset + audio OK
  await page.route('**/api/user/handshake', () => {})

  await page.goto('/')
  await expect(page.getByText('Weak connection')).toBeVisible({ timeout: 15000 })
})
