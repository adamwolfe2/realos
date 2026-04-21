import { test, expect } from "@playwright/test";

// @critical
// The intake wizard is the top-of-funnel for the entire business. If the
// 4-step flow breaks, no new client can sign up.
//
// We avoid actually scheduling a Cal.com slot (step 4 is external) and we
// use a clearly-marked test email so any email side-effects can be filtered.

const TEST_EMAIL = `playwright+${Date.now()}@example.com`;

test.describe("Onboarding intake wizard @critical", () => {
  test.beforeEach(async ({ page }) => {
    // Make sure we never replay a stale localStorage draft mid-suite.
    await page.goto("/onboarding");
    await page.evaluate(() => {
      try {
        window.localStorage.removeItem("realestaite.intake.v1");
      } catch {
        // Some browsers (or about:blank pages) deny localStorage; ignore.
      }
    });
    await page.reload();
  });

  test("step 1 renders the company form with all required fields", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /portfolio/i
    );
    // Step heading on the wizard card (h2).
    await expect(
      page.getByRole("heading", { level: 2, name: /tell us about your company/i })
    ).toBeVisible();

    // Required fields by label (semantic locator).
    await expect(page.getByLabel(/^company name/i)).toBeVisible();
    await expect(page.getByLabel(/^full name/i)).toBeVisible();
    await expect(page.getByLabel(/^email/i).first()).toBeVisible();
  });

  test("clicking continue without required fields shows validation", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(
      page.getByText(/fill in the required fields above/i)
    ).toBeVisible();
  });

  test("happy path: fills wizard and submits to /api/onboarding", async ({
    page,
  }) => {
    // ---- Step 1: company ----
    await page.getByLabel(/^company name/i).fill("Playwright Test Co");
    await page.getByLabel(/^full name/i).fill("Playwright Tester");
    await page.getByLabel(/^email/i).first().fill(TEST_EMAIL);
    // Property type is required; Residential is the default-friendly path.
    await page.getByRole("button", { name: /^residential$/i }).click();

    await page.getByRole("button", { name: /continue/i }).click();

    // ---- Step 2: portfolio ----
    await expect(
      page.getByRole("heading", { level: 2, name: /about your portfolio/i })
    ).toBeVisible();
    // biggestPainPoint is the only required field. Click any pain-point chip.
    await page
      .getByRole("button", { name: /current agency underperforms/i })
      .click();

    await page.getByRole("button", { name: /continue/i }).click();

    // ---- Step 3: services ----
    await expect(
      page.getByRole("heading", { level: 2, name: /which services/i })
    ).toBeVisible();

    // Watch for the actual API call before we click submit.
    const submitPromise = page.waitForResponse((r) =>
      r.url().includes("/api/onboarding") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: /book my call/i }).click();

    const submitResp = await submitPromise;
    expect(submitResp.status()).toBeLessThan(400);
    const body = await submitResp.json();
    expect(body.ok).toBe(true);
    expect(typeof body.submissionId).toBe("string");

    // ---- Step 4: confirmation ----
    await expect(page.getByText(/intake received/i)).toBeVisible();
  });
});
