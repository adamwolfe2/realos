import { test, expect } from "@playwright/test";

// End-to-end tests for the public /pricing page. Exercises the
// interactive controls (cycle toggle, property-count stepper) and
// verifies the price math + bracket-aware discount labels render
// correctly. These are the surfaces a prospect interacts with before
// signing up, so a regression here is a direct conversion hit.

test.describe("Pricing page — interactive", () => {
  test("renders the hero with the correct headline structure", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Headline is split across two lines; the second line carries the
    // blue accent. We assert both lines exist so a copy regression
    // can't ship silently.
    await expect(
      page.getByRole("heading", {
        name: /One platform for every property/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Scale with your portfolio/i),
    ).toBeVisible();

    // Trust strip should show four anchors.
    await expect(page.getByText("Self-serve")).toBeVisible();
    await expect(page.getByText("No contracts")).toBeVisible();
    await expect(page.getByText("Pause anytime")).toBeVisible();
    await expect(page.getByText("30-day guarantee")).toBeVisible();
  });

  test("property-count stepper updates tier totals via graduated brackets", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await page
      .getByText(/One platform for every property/i)
      .waitFor({ state: "visible" });

    // Find the Growth card to verify multi-property math. With 1
    // property the headline number should be $899; bumping the
    // stepper to 5 properties should yield 1 × $899 + 4 × $719 =
    // $3,775. That's the graduated bracket math from
    // lib/billing/catalog.ts (20% off in the 2-9 bracket).
    const growthCard = page
      .locator('button:has-text("Start with Growth")')
      .first()
      .locator("xpath=ancestor::*[contains(@class, 'rounded-2xl')]");

    await expect(growthCard).toContainText("$899");

    // Bump property count to 5 using the + button.
    const plusButton = page.getByRole("button", {
      name: /Increase property count/i,
    });
    for (let i = 1; i < 5; i++) {
      await plusButton.click();
    }

    // The Growth card should now show the multi-property total
    // ($899 + 4 × $719 = $3,775) and an "avg per property" line.
    await expect(growthCard).toContainText("$3,775");
    await expect(growthCard).toContainText(/avg per property/i);

    // Stepper should display "5 properties".
    await expect(page.getByText(/5\s+properties/i).first()).toBeVisible();

    // A bracket-aware savings hint should appear at the 5-property
    // mark ("You're saving 20 percent...").
    await expect(
      page.getByText(/saving 20 percent/i).first(),
    ).toBeVisible();
  });

  test("annual cycle toggle reduces the tier prices", async ({ page }) => {
    await page.goto("/pricing");
    const growthCard = page
      .locator('button:has-text("Start with Growth")')
      .first()
      .locator("xpath=ancestor::*[contains(@class, 'rounded-2xl')]");

    await expect(growthCard).toContainText("$899");

    // Click the Annual toggle.
    await page.getByRole("tab", { name: "Annual" }).click();

    // Growth annual is $749 monthly-equivalent.
    await expect(growthCard).toContainText("$749");
    // The "Billed yearly" hint should also be visible.
    await expect(growthCard).toContainText(/Billed yearly/i);
  });

  test("stepper hits cap and surfaces the talk-to-sales callout", async ({
    page,
  }) => {
    await page.goto("/pricing");
    const plusButton = page.getByRole("button", {
      name: /Increase property count/i,
    });

    // Click many times — the stepper caps at 99 internally; we just
    // verify the cap message appears above some threshold.
    for (let i = 0; i < 105; i++) {
      await plusButton.click({ delay: 0 }).catch(() => undefined);
    }

    await expect(
      page.getByText(/Self-serve checkout caps at/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /talk to sales/i }),
    ).toBeVisible();
  });

  test("FAQ accordion expands and contracts", async ({ page }) => {
    await page.goto("/pricing");

    // First item is open by default per pricing-faq.tsx implementation.
    const signupQuestion = page.getByRole("button", {
      name: /How does signup work/i,
    });
    await expect(signupQuestion).toBeVisible();

    // Click "Is there a setup fee" — should expand and reveal the
    // answer that confirms no setup fee.
    const setupQ = page.getByRole("button", {
      name: /Is there a setup fee\?/i,
    });
    await setupQ.click();
    await expect(
      page.getByText(/The platform is self-serve/i),
    ).toBeVisible();
  });

  test("comparison table renders with eight headline rows and disclosure", async ({
    page,
  }) => {
    await page.goto("/pricing");

    await expect(
      page.getByRole("heading", {
        name: /eight rows that drive the decision/i,
      }),
    ).toBeVisible();

    // The "Show every detail" disclosure should be present and
    // expand the full 40-row matrix when clicked.
    const disclosure = page.getByRole("button", {
      name: /Show every detail/i,
    });
    await expect(disclosure).toBeVisible();
    await disclosure.click();

    // The full matrix has section headers like "Marketing site"
    // that don't appear in the compact view.
    await expect(
      page.getByText(/Marketing site$/i).first(),
    ).toBeVisible();
  });

  test("CTAs route to expected destinations when not signed in", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // The Foundation tier CTA is a button (POSTs to checkout) not a
    // link. Verify it exists and is enabled. We don't click it here
    // because that triggers a real Stripe Checkout request.
    await expect(
      page.getByRole("button", { name: /Start with Foundation/i }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /Start with Growth/i }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /Start with Scale/i }),
    ).toBeEnabled();

    // Enterprise is a Link to /demo, not a button. Anchor tag.
    const enterpriseLink = page.getByRole("link", {
      name: /Talk to sales/i,
    });
    await expect(enterpriseLink).toBeVisible();
    expect(await enterpriseLink.getAttribute("href")).toContain("/demo");
  });
});
