import { expect, test } from '@playwright/test'

test('renders the client-only market admin shell without auth backend UI', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText(/market-admin/i)).toBeVisible()
  await expect(page.getByRole('group', { name: /environment/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /connect/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toHaveCount(0)

  await page.getByRole('button', { name: /open market/i }).click()
  await expect(page.getByText(/AccessManager\.multicall/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /shareable review link/i })).toBeVisible()
})
