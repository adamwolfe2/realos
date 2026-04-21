import { test, expect } from "@playwright/test";

// @critical
// Portal and admin must redirect unauthenticated users to /sign-in.
// If this guard breaks, every operator-only surface leaks publicly.
//
// We don't programmatically sign in here — that requires Clerk testing
// tokens which aren't wired yet (see e2e/helpers/auth-stub.ts). The
// deep-flow tests below are skipped with a clear TODO so they're easy to
// turn on once auth is hooked up.

const PROTECTED_ROUTES = [
  "/portal",
  "/portal/leads",
  "/portal/properties",
  "/portal/settings/integrations",
  "/admin",
  "/admin/intakes",
];

test.describe("Auth redirect smoke @critical", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`unauthenticated GET ${route} -> /sign-in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/sign-in/);
      // Sign-in heading should render.
      await expect(
        page.getByRole("heading", { name: /sign in/i }).first()
      ).toBeVisible();
    });
  }
});
