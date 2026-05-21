import { test } from "@playwright/test";
import { AUTH_NOT_WIRED_MESSAGE } from "../helpers/auth-stub";

// Content-draft workflow end-to-end. Skipped until Clerk Testing Tokens
// land (same blocker as e2e/portal/operator-flows.spec.ts). Each test
// documents the exact assertions to make when enabled.

test.describe("SEO content-draft workflow (skipped: auth not wired)", () => {
  test.skip(true, AUTH_NOT_WIRED_MESSAGE);

  test("operator opens the draft launcher modal on /portal/seo/agent", async () => {
    // - Navigate to /portal/seo/agent
    // - Wait for "Take action" panel
    // - Click "Generate draft"
    // - Expect modal with role="dialog" and the 6 format options to render
    // - Expect Cancel + Generate buttons
  });

  test("operator submits a draft and sees pending state", async () => {
    // - Open the modal, pick BLOG_POST
    // - Type a brief into the textarea (>= 8 chars)
    // - Click Generate
    // - Expect a toast "Draft ready" within 30s
    // - Modal closes
  });

  test("operator can add and remove a target query", async () => {
    // - Navigate to /portal/seo/agent
    // - Scroll to the target-query manager
    // - Type "apartments in test city" + click Add
    // - Expect the row to appear under "Active"
    // - Click Remove
    // - Expect the row to move to "Inactive"
  });

  test("recommendation refresh triggers a router refresh and toast", async () => {
    // - Click "Refresh recommendations"
    // - Expect a toast "Refreshed 1 property."
    // - Expect the recommendations panel to repaint
  });
});

test.describe("Admin content-drafts queue (skipped: admin auth not wired)", () => {
  test.skip(true, AUTH_NOT_WIRED_MESSAGE);

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
