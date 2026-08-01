import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Regression: syncListingsForOrg() used to access properties[0].addressLine1
// unguarded on the single-property embed-scrape path. When an org has an
// AppFolio integration configured but zero AppFolio-backed properties yet
// (mid-onboarding, or the last one was deleted), `properties` is `[]` and
// that line throws a raw TypeError that surfaced as the tenant-facing sync
// error message instead of a clean skip.
//
// Structural source check (syncListingsForOrg's fetchEmbedScrape/fetchRest
// helpers are unexported and network-backed, making a full behavioral mock
// heavy for a one-branch null-guard fix — same convention as
// feature-stripe-idempotency.test.ts).
// ---------------------------------------------------------------------------

const src = fs.readFileSync(
  path.resolve(__dirname, "../lib/integrations/appfolio.ts"),
  "utf-8",
);

describe("syncListingsForOrg — empty properties guard", () => {
  it("checks properties.length === 0 before the single-property branch that reads properties[0]", () => {
    const emptyGuardIndex = src.indexOf("properties.length === 0");
    const addressReadIndex = src.indexOf("properties[0].addressLine1");
    expect(emptyGuardIndex).toBeGreaterThan(-1);
    expect(addressReadIndex).toBeGreaterThan(-1);
    // The empty-array guard must come before the unguarded read so the
    // `else` branch reaching properties[0] is only possible when
    // properties.length === 1.
    expect(emptyGuardIndex).toBeLessThan(addressReadIndex);
  });
});
