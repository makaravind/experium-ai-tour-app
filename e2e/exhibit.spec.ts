import { test, expect } from '@playwright/test'

// Sample exhibit seeded in Supabase during initial setup
const SAMPLE_EXHIBIT_ID = 'b7e34f4b-41da-43d5-8fd0-7c61857da9ca'

test('exhibit page shows name and listen button', async ({ page }) => {
  await page.goto(`/s/${SAMPLE_EXHIBIT_ID}`)
  await expect(page.getByRole('heading', { name: 'Ancient Banyan Tree' })).toBeVisible()
  await expect(page.getByRole('button', { name: /listen/i })).toBeVisible()
})

test('unknown code shows 404', async ({ page }) => {
  const res = await page.goto('/s/00000000-0000-0000-0000-000000000000')
  expect(res?.status()).toBe(404)
})
