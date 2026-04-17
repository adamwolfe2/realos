import { test, expect } from '@playwright/test'

test.describe('Standing orders page', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/client-portal/standing-orders', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/sign-in/)
  })

  test('standing-orders route is part of the client-portal auth-guarded area', async ({ page }) => {
    // Navigate without auth — should be redirected away from the standing orders page
    await page.goto('/client-portal/standing-orders', { waitUntil: 'networkidle' })
    await expect(page).not.toHaveURL('/client-portal/standing-orders')
  })

  test('standing-orders URL structure is correct', async ({ page }) => {
    // Confirm the correct path is used (not /standing-order singular)
    const response = await page.request.get('/client-portal/standing-orders')
    // Should either redirect (3xx) or return a page — not 404
    expect(response.status()).not.toBe(404)
  })
})
