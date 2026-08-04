import { test, expect } from '@playwright/test'

const EXHIBIT_ID = 'b7e34f4b-41da-43d5-8fd0-7c61857da9ca'

test.describe('Nature Audio Tour — smoke', () => {
  test('home page renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Nature Audio Tour' })).toBeVisible()
    await expect(page.getByText('Scan a marker in the park to begin.')).toBeVisible()
  })

  test('exhibit page loads real data from Supabase', async ({ page }) => {
    await page.goto(`/s/${EXHIBIT_ID}`)

    // exhibit name + scientific name (from seed row)
    await expect(page.getByRole('heading', { name: 'Ancient Banyan Tree' })).toBeVisible()
    await expect(page.getByText('Ficus benghalensis')).toBeVisible()

    // type/tier badge
    await expect(page.getByText(/plant.*Tier A/i)).toBeVisible()

    // language selector has 3 options
    const select = page.getByRole('combobox')
    await expect(select).toBeVisible()
    await expect(select.locator('option')).toHaveCount(3)

    // listen button
    await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
  })

  test('unknown exhibit code returns 404', async ({ page }) => {
    const res = await page.goto('/s/00000000-0000-0000-0000-000000000000')
    expect(res?.status()).toBe(404)
  })
})
