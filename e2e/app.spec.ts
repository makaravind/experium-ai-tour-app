import { test, expect } from '@playwright/test'
import { mockPrecacheDataset, passLanguageGate } from './gate-helpers'

const QR_CODE = 'baobab-forest'

test.describe('Nature Audio Tour — smoke', () => {
  test('home page renders', async ({ page }) => {
    // AppGate gates Home too: fresh visitor taps a language, waits for precache, skips the info modal
    await mockPrecacheDataset(page)
    await page.goto('/')
    await passLanguageGate(page)
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(page.getByText('Welcome to Experium')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Scan Now' })).toBeVisible()
  })

  test('exhibit page loads real data from Supabase', async ({ page }) => {
    // Fresh visitor must pass AppGate (dataset mocked, see gate-helpers); the exhibit itself is
    // still loaded for real from Supabase by the page.
    await mockPrecacheDataset(page)
    await page.goto(`/s/${QR_CODE}`)
    await passLanguageGate(page)
    await page.getByRole('button', { name: 'Skip for now' }).click()

    // exhibit name visible in BottomSheet
    await expect(page.getByText('Baobab Forest')).toBeVisible({ timeout: 6000 })

    // listen button
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
  })

  test('unknown exhibit code renders not-found message', async ({ page }) => {
    const res = await page.goto('/s/nonexistent-code-xyz')
    expect(res?.status()).toBe(200)
    await expect(page.getByText('Exhibit not found.')).toBeVisible({ timeout: 15_000 })
  })
})
