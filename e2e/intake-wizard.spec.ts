import { test, expect } from "@playwright/test";

test.describe("Intake wizard", () => {
  test("intake form section loads on homepage", async ({ page }) => {
    await page.goto("/#intake-form", { waitUntil: "networkidle" });

    // The intake form section should be visible
    const intakeSection = page.locator("#intake-form");
    await expect(intakeSection).toBeVisible();
  });

  test("step 1 loads with company name field", async ({ page }) => {
    await page.goto("/#intake-form", { waitUntil: "networkidle" });

    // Company Name input should be present
    const companyNameInput = page.locator("#intake-companyName");
    await expect(companyNameInput).toBeVisible();
    await expect(companyNameInput).toHaveAttribute("placeholder", /Pacific Seafood/);
  });

  test("can fill company name field", async ({ page }) => {
    await page.goto("/#intake-form", { waitUntil: "networkidle" });

    const companyNameInput = page.locator("#intake-companyName");
    await companyNameInput.fill("Acme Distribution Co.");
    await expect(companyNameInput).toHaveValue("Acme Distribution Co.");
  });

  test("step indicators are visible", async ({ page }) => {
    await page.goto("/#intake-form", { waitUntil: "networkidle" });

    // The wizard shows step headings; the first step heading should be visible
    const stepHeading = page.locator("#intake-form").getByRole("heading");
    await expect(stepHeading.first()).toBeVisible();
  });
});
