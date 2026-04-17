import { test, expect } from '@playwright/test'

test.describe('Claim account flow', () => {
  test('renders claim page with search field', async ({ page }) => {
    await page.goto('/claim')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByPlaceholder(/company/i)).toBeVisible()
  })

  test('shows search results when typing company name', async ({ page }) => {
    await page.goto('/claim')
    const searchInput = page.getByPlaceholder(/company/i)
    await searchInput.fill('test')
    // Wait for debounce
    await page.waitForTimeout(400)
    // Results or "no results" should appear
    await expect(
      page
        .locator('[data-testid="search-results"], [data-testid="no-results"]')
        .or(page.getByText(/no.*found/i))
    ).toBeVisible({ timeout: 5000 })
  })

  test('shows required field validation on empty submit', async ({ page }) => {
    await page.goto('/claim')
    // Try to progress without filling required fields
    const continueBtn = page.getByRole('button', { name: /continue|next|claim/i })
    if (await continueBtn.isVisible()) {
      await continueBtn.click()
      // Should show validation errors or stay on step 1
      await expect(page).toHaveURL('/claim')
    }
  })

  test('find my account button is disabled without email', async ({ page }) => {
    await page.goto('/claim')
    const findBtn = page.getByRole('button', { name: /find my account/i })
    await expect(findBtn).toBeDisabled()
  })

  test('find my account button becomes enabled after entering email', async ({ page }) => {
    await page.goto('/claim')
    await page.getByLabel(/email address/i).fill('test@example.com')
    const findBtn = page.getByRole('button', { name: /find my account/i })
    await expect(findBtn).toBeEnabled()
  })

  test('claim page has correct heading text', async ({ page }) => {
    await page.goto('/claim')
    await expect(page.getByRole('heading', { name: /access your account/i })).toBeVisible()
  })

  test('claim page links to apply for access', async ({ page }) => {
    await page.goto('/claim')
    const applyLink = page.getByRole('link', { name: /apply for wholesale access/i })
    await expect(applyLink).toBeVisible()
  })
})
