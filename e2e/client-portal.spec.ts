import { test, expect } from "@playwright/test";

test.describe("Client portal (auth guard smoke tests)", () => {
  test("navigating to /client-portal redirects to sign-in", async ({ page }) => {
    await page.goto("/client-portal", { waitUntil: "networkidle" });

    // Clerk middleware or layout auth guard should redirect unauthenticated users
    await expect(page).toHaveURL(/sign-in/);
  });

  test("navigating to /catalog loads catalog page", async ({ page }) => {
    // Catalog is publicly accessible (no auth guard in middleware or layout)
    await page.goto("/catalog", { waitUntil: "networkidle" });

    // Should stay on /catalog (not redirected)
    await expect(page).toHaveURL(/catalog/);
  });

  test("sign-in page loads correctly", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "networkidle" });

    // The sign-in page should display the heading
    const heading = page.getByRole("heading", { name: /Sign in/i });
    await expect(heading).toBeVisible();

    // Should display the Wholesail brand in header
    await expect(page.getByText("Wholesail").first()).toBeVisible();

    // Should have a link to apply for wholesale access
    const applyLink = page.getByText("Apply for wholesale access");
    await expect(applyLink).toBeVisible();
  });
});
