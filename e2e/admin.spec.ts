import { test, expect } from "@playwright/test";

test.describe("Admin area (auth guard smoke tests)", () => {
  test("navigating to /admin redirects to sign-in", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "networkidle" });

    // Clerk middleware redirects unauthenticated users to /sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-in page loads after admin redirect", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "networkidle" });

    // Should be on the sign-in page
    await expect(page).toHaveURL(/sign-in/);

    // The sign-in page heading should be visible
    const heading = page.getByRole("heading", { name: /Sign in/i });
    await expect(heading).toBeVisible();
  });
});
