import { test, expect } from "@playwright/test";

// @critical
// Digital Performance Score quiz — public lead magnet at /audit. Adam
// 2026-06-01.
//
// This spec exercises the FRONT half of the flow (quiz UI + form
// submission) but stops short of waiting for a real scan to complete —
// the scan calls DataForSEO, four AEO engines, Tavily, and Anthropic,
// which is too slow and too API-dependent for a critical-path test.
// Instead we assert the user-visible quiz contract:
//   1. Quiz renders with the expected step count + question text.
//   2. Back / Next buttons honor step bounds.
//   3. Each input type works (single-choice, multi-choice "None"
//      mutual exclusion, URL).
//   4. The final step's submit button is "Get my Digital Performance
//      Score" and disabled until the URL is supplied.
//   5. Every recommendation feature-page link in the catalog resolves
//      to a real route (no 404s) — checked separately so a broken
//      catalog never silently ships.

const QUIZ_TOTAL_STEPS = 8;

const FEATURE_PAGES_WITH_DEDICATED_ROUTES = [
  "/features/chatbot",
  "/features/pixel",
  "/features/ads",
  "/features/seo-aeo",
  "/features/keyword-trends",
  "/features/website-build",
  "/features/popups",
];

test.describe("Audit quiz @critical", () => {
  test("/audit renders the DPS quiz hero", async ({ page }) => {
    const resp = await page.goto("/audit");
    expect(resp?.status(), "/audit HTTP status").toBeLessThan(400);

    // Hero headline — uses the rebranded DPS copy.
    await expect(
      page.getByRole("heading", { level: 1 }),
      "DPS hero heading",
    ).toContainText(/How is your property actually performing online/i);

    // Step indicator shows "Step 1 of 8".
    await expect(page.getByText(`Step 1 of ${QUIZ_TOTAL_STEPS}`)).toBeVisible();
  });

  test("quiz Next button is disabled until a choice is selected", async ({
    page,
  }) => {
    await page.goto("/audit");
    const nextBtn = page.getByRole("button", { name: /^Next$/ });
    await expect(nextBtn).toBeDisabled();

    // Select the first single-choice option ("Student housing").
    await page.getByRole("button", { name: /Student housing/i }).click();
    await expect(nextBtn).toBeEnabled();
  });

  test("Back button reaches step 1 and disables there", async ({ page }) => {
    await page.goto("/audit");

    // Advance to step 2.
    await page.getByRole("button", { name: /Student housing/i }).click();
    await page.getByRole("button", { name: /^Next$/ }).click();
    await expect(
      page.getByText(`Step 2 of ${QUIZ_TOTAL_STEPS}`),
    ).toBeVisible();

    // Click Back, land at step 1, Back disabled.
    await page.getByRole("button", { name: /^← Back$/ }).click();
    await expect(
      page.getByText(`Step 1 of ${QUIZ_TOTAL_STEPS}`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^← Back$/ }),
    ).toBeDisabled();
  });

  test("multi-select 'None of these' is mutually exclusive", async ({
    page,
  }) => {
    await page.goto("/audit");

    // Steps 1-3 (property type, portfolio size, tour booking) — accept
    // any default option so we land on the multi-select at step 4.
    await page.getByRole("button", { name: /Student housing/i }).click();
    await page.getByRole("button", { name: /^Next$/ }).click();
    await page.getByRole("button", { name: /^1 property$/i }).click();
    await page.getByRole("button", { name: /^Next$/ }).click();
    await page.getByRole("button", { name: /Online self-serve booking/i }).click();
    await page.getByRole("button", { name: /^Next$/ }).click();

    // Step 4: site_features multi-select.
    await expect(
      page.getByText(`Step 4 of ${QUIZ_TOTAL_STEPS}`),
    ).toBeVisible();

    const aiChatbot = page.getByRole("button", { name: /^AI chatbot$/i });
    const none = page.getByRole("button", { name: /^None of these$/i });
    await aiChatbot.click();
    await expect(aiChatbot).toHaveAttribute("aria-pressed", "true");

    // Selecting "None of these" clears the other choices.
    await none.click();
    await expect(none).toHaveAttribute("aria-pressed", "true");
    await expect(aiChatbot).toHaveAttribute("aria-pressed", "false");

    // Selecting another choice clears "None of these".
    await aiChatbot.click();
    await expect(aiChatbot).toHaveAttribute("aria-pressed", "true");
    await expect(none).toHaveAttribute("aria-pressed", "false");
  });

  test("final step shows DPS submit CTA + URL input", async ({ page }) => {
    await page.goto("/audit");

    // Walk every required step using its first listed answer so the
    // final-step submit button surfaces.
    const advances = [
      /Student housing/i,
      /^1 property$/i,
      /Online self-serve booking/i,
      // Step 4 (site_features) is optional — click an explicit choice
      // so the Next button enables.
      /^None of these$/i,
      /Auto-monitored/i,
      // Step 6 (lead_sources) is optional — click a choice so Next
      // enables.
      /^Not sure$/i,
      /Visitor pixel \+ analytics/i,
    ];
    for (const label of advances) {
      // Multi-select steps don't auto-advance; for those we still need
      // to hit "Next" after selecting a choice. The single-loop
      // approach handles both.
      const choiceBtn = page
        .getByRole("button", { name: label })
        .first();
      if (await choiceBtn.isVisible()) {
        await choiceBtn.click();
      }
      const nextBtn = page.getByRole("button", { name: /^Next$/ });
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
      }
    }

    // Final step: URL input + "Get my Digital Performance Score" CTA.
    await expect(
      page.getByText(`Step ${QUIZ_TOTAL_STEPS} of ${QUIZ_TOTAL_STEPS}`),
    ).toBeVisible();
    const submit = page.getByRole("button", {
      name: /Get my Digital Performance Score/i,
    });
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();

    // Fill the URL and the submit button enables.
    await page
      .getByPlaceholder(/yourproperty\.com/i)
      .fill("example-property.com");
    await expect(submit).toBeEnabled();
  });

  test("every catalog feature page with a dedicated route renders", async ({
    page,
  }) => {
    // Guarantees the recommendation engine's "See it live" links never
    // silently route to a 404 if the directory is renamed or removed.
    for (const path of FEATURE_PAGES_WITH_DEDICATED_ROUTES) {
      const resp = await page.goto(path);
      expect(
        resp?.status(),
        `${path} HTTP status`,
      ).toBeLessThan(400);
      const h1 = page.locator("h1").first();
      await expect(h1, `${path} should render an h1`).toBeVisible({
        timeout: 6_000,
      });
    }
  });
});
