import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// P1 — /admin/pricing "Sync to Stripe" must be idempotent. A prior run could
// create a Stripe price then fail before persisting price.id, orphaning it; the
// next run would mint a duplicate. The sync now reuses an existing active price
// matched by lookup_key + amount before creating a new one.

const src = fs.readFileSync(
  path.resolve(__dirname, "../lib/billing/feature-stripe.ts"),
  "utf-8",
);

describe("feature-stripe sync idempotency", () => {
  it("looks up an existing price by lookup_key before creating", () => {
    expect(src).toMatch(/prices\s*\.\s*list\(\s*\{[^}]*lookup_keys/);
  });

  it("reuses a matching active price instead of always minting a new one", () => {
    expect(src).toContain("const reusable");
    expect(src).toMatch(/unit_amount === row\.monthlyCents/);
    // The create is now conditional on no reusable price.
    expect(src).toMatch(/reusable\s*\?\?/);
  });
});
