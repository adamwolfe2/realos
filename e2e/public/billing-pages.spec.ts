import { test, expect } from "@playwright/test";

// Public-facing billing landing pages. These are the destinations
// Stripe Checkout redirects users to after payment, so they need to
// render correctly even with no Clerk session (anonymous prospect
// path) and without a real session_id query param.

test.describe("Billing landing pages", () => {
  test("/billing/success renders the anonymous create-account rail", async ({
    page,
  }) => {
    await page.goto("/billing/success");

    await expect(
      page.getByRole("heading", { name: /subscription is active/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/Create your account with the same email/i),
    ).toBeVisible();

    // CTAs: create account (primary) + sign in (secondary).
    await expect(
      page.getByRole("link", { name: /Create your account/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Sign in$/i }),
    ).toBeVisible();

    // The "What happens next" card should list the four onboarding
    // steps a new customer expects.
    await expect(
      page.getByText(/Sign up with the email you used at checkout/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Add your first property and pick your branding/i),
    ).toBeVisible();
  });

  test("/billing/website-build/success surfaces Cal.com kickoff link", async ({
    page,
  }) => {
    await page.goto("/billing/website-build/success");

    await expect(
      page.getByRole("heading", { name: /Your website build is in the queue/i }),
    ).toBeVisible();

    // Primary CTA points to the Cal.com kickoff call link from
    // lib/billing/catalog.ts -> WEBSITE_BUILD_CAL_LINK. If this
    // anchor breaks, customers can't book their kickoff call.
    const calLink = page.getByRole("link", { name: /Book kickoff call/i });
    await expect(calLink).toBeVisible();
    const href = await calLink.getAttribute("href");
    expect(href).toContain("cal.com/adamwolfe/leasestack");

    // "What happens next" 5-step list
    await expect(page.getByText(/Book your kickoff call/i)).toBeVisible();
    await expect(
      page.getByText(/Design starts within 48 hours/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Site goes live on your domain/i),
    ).toBeVisible();
  });
});
