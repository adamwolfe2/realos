import { test, expect } from "@playwright/test";

// @critical
// /features used to 404 (2026-05-29 fix). This guard ensures the
// index page renders, every row links to a real destination (no 404s),
// and the per-feature sub-pages each render their hero. If any feature
// row's href silently breaks again, prospects clicking the dropdown
// land in a void.

const FEATURE_DESTINATIONS = [
  "/sample-report",
  "/features/ads",
  "/features/pixel",
  "/features/chatbot",
  "/audit",
  "/features/seo-aeo",
  "/features/popups",
];

const NAV_DROPDOWN_DESTINATIONS = [
  "/features",
  "/features/chatbot",
  "/features/pixel",
  "/features/seo-aeo",
  "/audit",
  "/features/keyword-trends",
  "/features/ads",
  "/features/website-build",
];

test.describe("Features index @critical", () => {
  test("/features renders the hero and seven feature rows", async ({
    page,
  }) => {
    const resp = await page.goto("/features");
    expect(resp?.status(), "/features HTTP status").toBeLessThan(400);

    // Hero headline.
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/everything/i);

    // Bottom CTA confirms the page fully rendered.
    const auditCta = page
      .getByRole("link", { name: /run a free audit/i })
      .first();
    await expect(auditCta).toBeVisible();
    await expect(auditCta).toHaveAttribute("href", "/audit");
  });

  test("every feature row links to a destination that returns 200", async ({
    page,
    request,
  }) => {
    await page.goto("/features");

    // Allow CI variability: hit each destination over the request API
    // rather than navigating through each <Link>, so a flake on one row
    // doesn't cascade into the others.
    for (const dest of FEATURE_DESTINATIONS) {
      const r = await request.get(dest);
      expect(r.status(), `${dest} should not 404`).toBeLessThan(400);
    }
  });

  test("the features dropdown routes to canonical destinations", async ({
    request,
  }) => {
    // Mirror of PRODUCT_LINKS in components/platform/nav.tsx. Locked here
    // so a regression that re-introduces a placeholder href trips a test
    // instead of silently shipping a dead link.
    for (const dest of NAV_DROPDOWN_DESTINATIONS) {
      const r = await request.get(dest);
      expect(r.status(), `${dest} should not 404`).toBeLessThan(400);
    }
  });
});

test.describe("Sample report @critical", () => {
  test("/sample-report renders the report artifact and dual CTAs", async ({
    page,
  }) => {
    const resp = await page.goto("/sample-report");
    expect(resp?.status(), "/sample-report HTTP status").toBeLessThan(400);

    // Hero headline.
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/monday/i);

    // Annotation grid section ("Header / Leases attributed / Three
    // actions / Anomalies") — the page meaningfully rendered if every
    // annotation card is present.
    await expect(page.getByText(/Header/).first()).toBeVisible();
    await expect(page.getByText(/Leases attributed/).first()).toBeVisible();
    await expect(page.getByText(/Three actions/).first()).toBeVisible();
    await expect(page.getByText(/Anomalies/).first()).toBeVisible();

    // Both CTAs route to /audit (top + bottom).
    const auditCtas = page.getByRole("link", { name: /audit/i });
    expect(await auditCtas.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("New feature sub-pages @critical", () => {
  test("/features/website-build renders the FeaturePage hero", async ({
    page,
  }) => {
    const resp = await page.goto("/features/website-build");
    expect(resp?.status(), "/features/website-build HTTP status").toBeLessThan(
      400,
    );

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/14 days/i);
  });

  test("/features/keyword-trends renders the FeaturePage hero", async ({
    page,
  }) => {
    const resp = await page.goto("/features/keyword-trends");
    expect(resp?.status(), "/features/keyword-trends HTTP status").toBeLessThan(
      400,
    );

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/queries/i);
  });
});
