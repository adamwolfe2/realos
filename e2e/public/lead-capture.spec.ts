import { test, expect } from "@playwright/test";
import { TEST_TENANT } from "../fixtures/test-tenant";
import { SECURE_CONTEXT_POLYFILL } from "../helpers/secure-context-polyfill";

// @critical
// Submitting the lead capture form on a tenant site is the primary
// monetization event. We verify:
//   1. The form submits to /api/public/leads with a 2xx response.
//   2. The success state ("Thanks, we'll be in touch.") renders.

const TENANT_BASE = `http://${TEST_TENANT.hostname}:3000`;

test.describe("Tenant lead capture @critical", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ content: SECURE_CONTEXT_POLYFILL });
  });

  test("contact form submits and shows confirmation", async ({ page }) => {
    // Generous timeout on first navigation: Turbopack compiles the
    // tenant-site route on demand the first time it's hit in a dev
    // session, which can take several seconds.
    await page.goto(`${TENANT_BASE}/contact`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    // The exit-intent popup also renders an input[name="firstName"]
    // (when triggered). Scope to the first visible one in the page
    // body to avoid strict-mode collisions with hidden popup forms.
    const firstName = page.locator('input[name="firstName"]').first();
    const lastName = page.locator('input[name="lastName"]').first();
    const email = page.locator('input[name="email"]').first();
    const phone = page.locator('input[name="phone"]').first();
    const notes = page.locator('textarea[name="notes"]').first();

    await expect(firstName).toBeVisible({ timeout: 15_000 });

    await firstName.fill("Playwright");
    await lastName.fill("Lead");
    await email.fill(`playwright+lead-${Date.now()}@example.com`);
    await phone.fill("555-555-5555");
    await notes.fill("Submitted by the Playwright lead-capture spec.");

    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/public/leads") &&
        r.request().method() === "POST"
    );
    await page.getByRole("button", { name: /send message/i }).click();

    const resp = await respPromise;
    expect(resp.status(), "POST /api/public/leads status").toBeLessThan(400);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(typeof body.leadId).toBe("string");

    await expect(
      page.getByRole("heading", { name: /thanks, we'll be in touch/i })
    ).toBeVisible();
  });
});
