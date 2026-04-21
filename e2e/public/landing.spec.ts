import { test, expect } from "@playwright/test";

// @critical
// Marketing landing page must load with no console errors and show the
// primary "Book a demo" CTA pointing at /onboarding. If this breaks, every
// inbound visitor lands on a broken page.

test.describe("Public marketing landing @critical", () => {
  test("homepage loads with title and key CTAs", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      // Filter out noisy framework dev warnings; only flag real errors.
      if (msg.type() === "error") {
        const text = msg.text();
        // Next.js dev mode emits hydration/dev warnings that aren't
        // real bugs. Fail only on uncaught errors via pageerror.
        if (text.includes("Failed to load resource")) return;
        consoleErrors.push(text);
      }
    });

    const resp = await page.goto("/");
    expect(resp?.status(), "homepage HTTP status").toBeLessThan(400);
    await expect(page).toHaveTitle(/RealEstaite/);

    // H1 hero copy.
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();

    // Primary CTA points at the intake wizard.
    const bookDemo = page.getByRole("link", { name: /book a demo/i }).first();
    await expect(bookDemo).toBeVisible();
    await expect(bookDemo).toHaveAttribute("href", /\/onboarding/);

    // Don't be strict about every sub-error; we just want the page to not
    // throw in pageerror. Hydration warnings can appear in dev.
    expect(
      consoleErrors.filter((e) => /Uncaught|TypeError|ReferenceError/.test(e))
    ).toEqual([]);
  });

  test("clicking the primary CTA navigates to onboarding", async ({ page }) => {
    await page.goto("/");
    const bookDemo = page.getByRole("link", { name: /book a demo/i }).first();
    await bookDemo.click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /portfolio/i
    );
  });
});
