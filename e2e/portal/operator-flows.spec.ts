import { test, expect } from "@playwright/test";
import {
  DEMO_AUTH,
  NEEDS_DEMO_SERVER,
  signInAsOperator,
} from "../helpers/auth-stub";

// Authenticated operator flows against the demo-mode dev server (see
// playwright.config.ts + e2e/helpers/auth-stub.ts). Data is the seeded
// telegraph-commons demo client org — treat it as shared: prospects click
// through the same org, so tests here stay read-only.

test.describe("Portal operator flows", () => {
  test.skip(!DEMO_AUTH, NEEDS_DEMO_SERVER);

  test("dashboard loads with KPI tiles and section headings", async ({
    page,
  }) => {
    await signInAsOperator(page);
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true })
    ).toBeVisible();
    for (const tile of [
      "Leads (28d)",
      "Applications (28d)",
      "Signed leases (28d)",
    ]) {
      await expect(page.getByText(tile).first()).toBeVisible();
    }
    for (const section of ["Lead journey", "Conversations", "Lead source"]) {
      await expect(
        page.getByRole("heading", { name: section, exact: true }).first()
      ).toBeVisible();
    }
  });

  test("leads list loads and a lead detail page renders", async ({ page }) => {
    await page.goto("/portal/leads");
    await expect(
      page.getByRole("heading", { name: "Leads", exact: true })
    ).toBeVisible();
    // Two tables render a "Name" column (leads + applications) — either works.
    await expect(
      page.getByRole("columnheader", { name: "Name" }).first()
    ).toBeVisible();

    const detailLinks = page.locator(
      'a[href^="/portal/leads/"]:not([href*="compare"]):not([href*="curate"])'
    );
    await expect(detailLinks.first()).toBeVisible();
    await detailLinks.first().click();
    // First compile of the detail route can be slow on a cold dev server.
    await page.waitForURL(/\/portal\/leads\/[^/?#]+/, { timeout: 60_000 });
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("properties list renders the seeded property", async ({ page }) => {
    await page.goto("/portal/properties");
    await expect(
      page.getByRole("heading", { name: "Properties", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Telegraph Commons").first()).toBeVisible();
  });

  test("integrations marketplace shows the tile grid", async ({ page }) => {
    await page.goto("/portal/settings/integrations");
    await expect(
      page.getByRole("heading", { name: "Integrations", exact: true })
    ).toBeVisible();
    for (const tile of [
      "AppFolio",
      "Google Search Console",
      "Google Ads",
      "Meta Ads",
      "Cursive pixel",
    ]) {
      await expect(
        page.getByRole("heading", { name: tile, exact: true })
      ).toBeVisible();
    }
  });

  test("Cursive pixel connect form opens from its tile", async ({ page }) => {
    await page.goto("/portal/settings/integrations");
    await page
      .getByRole("heading", { name: "Cursive pixel", exact: true })
      .click();
    await expect(page.locator("#websiteUrl")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect Cursive" })
    ).toBeVisible();
    // ponytail: stops before submitting — a real submit files a pixel
    // request in the shared demo org that admins/prospects would see.
    // Submit-path coverage belongs at the API level with cleanup.
  });
});
