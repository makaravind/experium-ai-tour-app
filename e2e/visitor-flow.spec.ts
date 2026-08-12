import { test, expect } from '@playwright/test'

// "Baobab Forest" — the only active QR code seeded in Supabase
const QR_CODE = 'baobab-forest'

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

    await page.goto(`/s/${QR_CODE}`)
  })

  test('loading screen → info modal → exhibit view', async ({ page }) => {
    // 1. Loading screen
    await expect(page.getByText('Experium Park')).toBeVisible()
    await expect(page.getByText('Preparing your audio tour…')).toBeVisible()

    // 2. Info modal appears after loading completes (~2.5s)
    await expect(page.getByText('Personalize your experience')).toBeVisible({
      timeout: 6000,
    })

    // Skip the form — go straight to exhibit
    await page.getByRole('button', { name: 'Skip for now' }).click()

    // 3. Exhibit view: BottomSheet with exhibit name and Listen button
    await expect(page.getByText('Baobab Forest')).toBeVisible()
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
  })

  test('full golden path: listen → toast → milestone → dismiss', async ({ page }) => {
    // Fast-forward through loading + info modal
    await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 6000 })
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()

    // Open audio player
    await page.getByRole('button', { name: /listen/i }).click()

    // Audio player overlay is open — the player uses preload="auto"
    // (ExhibitView also has a preload="metadata" stub, so we target the player's element)
    await expect(page.locator('audio[preload="auto"]')).toBeAttached()

    // Simulate audio ending on the player element
    await page.evaluate(() => {
      document.querySelector('audio[preload="auto"]')?.dispatchEvent(new Event('ended'))
    })

    // Toast appears
    await expect(page.getByRole('status')).toBeVisible()
    await expect(page.getByRole('status')).toContainText('3/50 discovered')

    // Milestone modal (total_discovered: 3 is a milestone)
    await expect(page.getByText('Milestone reached')).toBeVisible({ timeout: 2000 })
    await expect(page.getByText('Explorer — 3 Discovered!')).toBeVisible()
    await expect(page.getByText('Warming up nicely!')).toBeVisible()

    // Dismiss milestone
    await page.getByRole('button', { name: 'Keep exploring →' }).click()
    await expect(page.getByText('Milestone reached')).not.toBeVisible()
  })

  test('info modal — Continue saves user info and proceeds', async ({ page }) => {
    await expect(page.getByText('Personalize your experience')).toBeVisible({ timeout: 6000 })

    await page.getByPlaceholder('Your name').fill('Test User')
    await page.getByRole('button', { name: 'Continue →' }).click()

    // Should reach exhibit view after submitting
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
  })
})

test.describe('Visitor flow — returning visitor', () => {
  test('skips loading + info modal when already onboarded', async ({ page }) => {
    // Simulate a returning visitor (already onboarded)
    await page.addInitScript(() => {
      localStorage.setItem('experium_onboarded', '1')
      localStorage.setItem(
        'experium-store',
        JSON.stringify({
          state: { language: 'en', visitedExhibits: [], totalDiscovered: 2 },
          version: 0,
        })
      )
    })

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
