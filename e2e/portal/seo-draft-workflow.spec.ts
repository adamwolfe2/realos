import { test, expect } from "@playwright/test";
import {
  DEMO_AUTH,
  NEEDS_DEMO_SERVER,
  NEEDS_ADMIN_SERVER,
} from "../helpers/auth-stub";
import { clickAndExpect } from "../helpers/ui";

// Content-draft workflow against the demo-mode dev server. The one test
// that spends real Anthropic credits (draft generation, ~15s of Claude) is
// gated behind E2E_SPEND=1 so the default suite is free to run.

test.describe("SEO content-draft workflow", () => {
  test.skip(!DEMO_AUTH, NEEDS_DEMO_SERVER);

  test("draft launcher modal opens with all six formats", async ({ page }) => {
    await page.goto("/portal/seo/agent");
    const dialog = page.getByRole("dialog");
    await clickAndExpect(
      page.getByRole("button", { name: "Generate draft" }).first(),
      dialog
    );
    for (const format of [
      "Blog post",
      "Neighborhood page",
      "Title + meta rewrite",
      "FAQ block",
      "Property description",
      "Ad copy",
    ]) {
      await expect(dialog.getByRole("button", { name: format })).toBeVisible();
    }
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Generate", exact: true })
    ).toBeVisible();
  });

  test("draft submit requires a brief", async ({ page }) => {
    await page.goto("/portal/seo/agent");
    await clickAndExpect(
      page.getByRole("button", { name: "Generate draft" }).first(),
      page.getByRole("dialog")
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Generate", exact: true })
      .click();
    await expect(
      page.getByText("Add a brief — at least one sentence.")
    ).toBeVisible();
  });

  test("operator submits a draft and sees the ready toast", async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_SPEND,
      "Generates a real draft (~15s of Claude spend). Set E2E_SPEND=1 to run."
    );
    test.setTimeout(90_000);

    await page.goto("/portal/seo/agent");
    const dialog = page.getByRole("dialog");
    await clickAndExpect(
      page.getByRole("button", { name: "Generate draft" }).first(),
      dialog
    );
    await dialog.getByRole("button", { name: "FAQ block" }).click();
    await dialog
      .locator("#brief")
      .fill("E2E check: answer common questions about tour scheduling.");
    await dialog.getByRole("button", { name: "Generate", exact: true }).click();
    await expect(page.getByText("Draft ready — admin will review.")).toBeVisible(
      { timeout: 60_000 }
    );
  });

  test("operator can add and remove a target query", async ({ page }) => {
    // Fixed string + API-side upsert => reruns are idempotent, and Remove
    // cleans the shared demo org back up even if a prior run died mid-test.
    const E2E_QUERY = "e2e tracked query (playwright)";

    await page.goto("/portal/seo/drafts");
    const input = page.getByPlaceholder("apartments near…");
    await input.fill(E2E_QUERY);
    // Add-click may race hydration; the API upserts, so a double click is safe.
    await clickAndExpect(
      page.getByRole("button", { name: "Add", exact: true }),
      page.getByText("Query added. Next scan will pull SERP data.")
    );
    await expect(page.getByText(E2E_QUERY, { exact: true })).toBeVisible();

    const row = page
      .locator("div")
      .filter({ hasText: E2E_QUERY })
      .filter({ has: page.getByRole("button", { name: "Remove" }) })
      .last();
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(E2E_QUERY, { exact: true })).toHaveCount(0);
  });

  test("recommendation refresh shows a refreshed toast", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/portal/seo/agent");
    await clickAndExpect(
      page.getByRole("button", { name: "Refresh recommendations" }),
      page.getByText(/Refreshed \d+ propert/),
      60_000
    );
  });
});

test.describe("Admin content-drafts queue", () => {
  // One dev server resolves one org: this run targets the client portal
  // (DEMO_TARGET=client), so the admin surface can't render here.
  test.skip(true, NEEDS_ADMIN_SERVER);

  test("admin sees pending drafts in the queue", async () => {
    // - Navigate to /admin/content-drafts
    // - Expect a status chip strip with "Pending"/"Approved"/etc.
    // - Expect at least one draft card linking to /admin/content-drafts/[id]
  });

  test("admin can approve a draft", async () => {
    // - Click into a pending draft
    // - Click the Approve button
    // - Expect redirect to /admin/content-drafts
    // - Expect the draft no longer in the Pending tab
    // - Expect status COMPLETED on the linked recommendation (DB check)
  });

  test("admin can request changes with required notes", async () => {
    // - Click into a pending draft
    // - Click Request changes WITHOUT notes -> expect inline error
    // - Fill in 4+ char notes -> click Request changes
    // - Expect success toast + redirect
  });
});
