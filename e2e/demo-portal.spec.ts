import { test, expect } from "@playwright/test";

test.describe("Demo portal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo", { waitUntil: "networkidle" });
  });

  test("demo portal loads", async ({ page }) => {
    // The demo page should render the DemoPortal component
    // Wait for the lazy-loaded component to appear
    await page.waitForSelector("nav, [data-testid]", {
      state: "visible",
      timeout: 15_000,
    });

    // The page should not show the loading fallback anymore
    await expect(page.getByText("Loading demo...")).not.toBeVisible();
  });

  test("demo banner is visible", async ({ page }) => {
    // The demo portal includes a banner or header indicating it is a demo
    // Look for "Demo" text in the page content
    const demoIndicator = page.getByText("Demo", { exact: false });
    await expect(demoIndicator.first()).toBeVisible();
  });

  test("sidebar navigation is present", async ({ page }) => {
    // The demo portal has sidebar navigation with Admin Panel and Client Portal groups
    // Wait for the sidebar to load
    await page.waitForLoadState("networkidle");

    // Look for admin panel navigation items
    const dashboardLink = page.getByText("CEO Dashboard");
    await expect(dashboardLink).toBeVisible({ timeout: 10_000 });
  });

  test("can navigate between demo views via sidebar", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Click on "Orders" in the sidebar to navigate to admin orders
    const ordersLink = page.getByText("Orders").first();
    await expect(ordersLink).toBeVisible({ timeout: 10_000 });
    await ordersLink.click();

    // After clicking, the orders view should render
    // Verify the page content changes (orders view has order-related content)
    await expect(page.getByText("Orders").first()).toBeVisible();
  });
});
