import { test, expect } from '@playwright/test'

const QR_CODE = 'baobab-forest'

test.describe('Nature Audio Tour — smoke', () => {
  test('home page renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Nature Audio Tour' })).toBeVisible()
    await expect(page.getByText('Scan a marker in the park to begin.')).toBeVisible()
  })

  test('exhibit page loads real data from Supabase', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('experium_onboarded', '1'))
    await page.goto(`/s/${QR_CODE}`)

    // exhibit name visible in BottomSheet
    await expect(page.getByText('Baobab Forest')).toBeVisible({ timeout: 6000 })

    // listen button
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
  })

  test('unknown exhibit code returns 404', async ({ page }) => {
    const res = await page.goto('/s/nonexistent-code-xyz')
    expect(res?.status()).toBe(404)
  })
})
