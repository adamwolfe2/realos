import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Slice 1c — pixel setup is self-serve; the human ops-fulfilment queue is
 * retired for new orgs. The 1-business-day handoff (connectPixel minting a
 * pixelProvisionRequest + emailing ops) was the onboarding bottleneck. New
 * orgs must land on the self-serve wizard; existing PENDING legacy orgs must
 * still be honored.
 */

const connect = fs.readFileSync(
  path.resolve(__dirname, "../lib/actions/cursive-connect.ts"),
  "utf-8",
);
const page = fs.readFileSync(
  path.resolve(__dirname, "../app/portal/settings/integrations/page.tsx"),
  "utf-8",
);

describe("Pixel self-serve retirement of human queue (Slice 1c)", () => {
  it("connectPixel no longer mints a new pixelProvisionRequest or emails ops", () => {
    // The bottleneck writes must be gone; a resurrected legacy form would
    // otherwise silently recreate the human handoff.
    expect(connect).not.toContain("pixelProvisionRequest.create");
    expect(connect).not.toContain("sendPixelRequestOpsEmail");
    // Retirement is documented + greppable.
    expect(connect).toMatch(/RETIRED \(Slice 1c\)/);
  });

  it("existing PENDING legacy orgs are still honored (disconnect can cancel)", () => {
    // The cancel path (disconnectPixel) must still reference the PENDING
    // status so in-flight legacy requests aren't stranded.
    expect(connect).toContain("PixelRequestStatus.PENDING");
    expect(connect).toContain("PixelRequestStatus.CANCELLED");
  });

  it("page routes new eligible orgs to the self-serve wizard, legacy view only for existing requests", () => {
    // PixelRequestPending renders only when a request already exists…
    expect(page).toMatch(/pendingPixelRequest\s*\?\s*\(\s*<PixelRequestPending/);
    // …otherwise an eligible org gets the wizard.
    expect(page).toMatch(/pixelEligible\s*\?\s*\(\s*<CursiveSetupWizard/);
  });
});
