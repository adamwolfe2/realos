// Demo-mode auth for E2E.
//
// The Playwright dev server runs with DEMO_MODE=true DEMO_TARGET=client
// (set in playwright.config.ts), which makes middleware pass /portal
// through without a Clerk session and getScope() resolve the seeded demo
// client org. Same bypass prospects use; hard-disabled when
// VERCEL_ENV/NODE_ENV is production (lib/tenancy/scope.ts). No new auth
// path was added for tests.
//
// Set E2E_DEMO=false to run the server in normal auth mode instead —
// authed specs then skip and the auth-redirect guard specs run.

import { expect, type Page } from "@playwright/test";

export const DEMO_AUTH = process.env.E2E_DEMO !== "false";

export const NEEDS_DEMO_SERVER =
  "Needs the demo-mode server. Run e2e without E2E_DEMO=false.";

export const NEEDS_REAL_AUTH_SERVER =
  "Auth redirects can't be observed on a demo-mode server. " +
  "Run `E2E_DEMO=false pnpm test:e2e` to exercise this guard.";

export const NEEDS_ADMIN_SERVER =
  "Admin surface needs a DEMO_TARGET=admin server; this run targets the " +
  "client portal. One dev server resolves one org.";

/** Navigate to /portal and assert we were NOT bounced to /sign-in. */
export async function signInAsOperator(page: Page): Promise<void> {
  await page.goto("/portal");
  await expect(page).not.toHaveURL(/\/sign-in/);
}
