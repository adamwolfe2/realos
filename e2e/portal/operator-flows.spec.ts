import { test } from "@playwright/test";
import { AUTH_NOT_WIRED_MESSAGE } from "../helpers/auth-stub";

// Authenticated operator flows.
//
// Skipped pending Clerk Testing Tokens setup. Once `signInAsOperator()` in
// e2e/helpers/auth-stub.ts is implemented, remove the `test.skip()` lines
// and the bodies below should run without further changes.
//
// Each test documents what it WILL assert when enabled.

test.describe("Portal operator flows (skipped: auth not wired)", () => {
  test.skip(true, AUTH_NOT_WIRED_MESSAGE);

  test("dashboard loads with KPI tiles", async () => {
    // - Navigate to /portal after sign-in
    // - Expect "Leads (28d)", "Tours scheduled", spend KPIs to render
    // - Expect activity feed list to render
    // - Expect no red error boundary
  });

  test("leads list loads and a lead detail page renders", async () => {
    // - Navigate to /portal/leads
    // - Expect a table with at least one row (seeded demo data)
    // - Click first row, expect /portal/leads/[id]
    // - Expect contact name + status to render
  });

  test("properties list renders", async () => {
    // - Navigate to /portal/properties
    // - Expect at least one property card
  });

  test("integrations marketplace shows SEO/Ads/Pixel tiles", async () => {
    // - Navigate to /portal/settings/integrations
    // - Expect tiles labeled: "AppFolio", "Google Search Console",
    //   "Google Ads", "Meta Ads", "Visitor identification"
  });

  test("can generate a pixel snippet and a pk_site_* key appears", async () => {
    // - Navigate to /portal/settings/integrations
    // - Click "Generate pixel snippet"
    // - Expect a code block containing /api/public/pixel/pk_site_
    // - Expect the displayed key prefix to start with "pk_site_"
  });
});
