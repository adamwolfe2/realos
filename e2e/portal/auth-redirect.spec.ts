import { test, expect } from "@playwright/test";
import { DEMO_AUTH, NEEDS_REAL_AUTH_SERVER } from "../helpers/auth-stub";

// @critical
// Portal and admin must redirect unauthenticated users to /sign-in.
// If this guard breaks, every operator-only surface leaks publicly.
//
// The default e2e server runs in demo mode (middleware passes /portal and
// /admin through by design), so these guard specs only run against a
// normal-auth server: `E2E_DEMO=false pnpm test:e2e`.

const PROTECTED_ROUTES = [
  "/portal",
  "/portal/leads",
  "/portal/properties",
  "/portal/settings/integrations",
  "/admin",
  "/admin/intakes",
];

test.describe("Auth redirect smoke @critical", () => {
  test.skip(DEMO_AUTH, NEEDS_REAL_AUTH_SERVER);

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
