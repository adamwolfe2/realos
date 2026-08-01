import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Regression: 4 cron routes had the N+1 anti-pattern the sibling
// billing-reminders cron already fixed — one findFirst() dedup lookup per
// org inside the loop instead of a single batched findMany() before it.
// Structural source check (same convention as feature-stripe-idempotency
// .test.ts) confirming each route now batches its dedup lookup instead of
// querying per org.
// ---------------------------------------------------------------------------

function readRoute(relPath: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", relPath), "utf-8");
}

describe("cron dedup batching — no per-org findFirst inside the loop", () => {
  it("trial-reminders batches the TrialReminderSent dedup lookup", () => {
    const src = readRoute("app/api/cron/trial-reminders/route.ts");
    expect(src).toMatch(/auditEvent\.findMany\(\{[\s\S]*?entityType:\s*"TrialReminderSent"/);
    expect(src).not.toMatch(/for \(const \{[^}]*\} of candidates\) \{[\s\S]{0,80}findFirst/);
  });

  it("onboarding-drip batches the legacy-step dedup lookup", () => {
    const src = readRoute("app/api/cron/onboarding-drip/route.ts");
    expect(src).toMatch(/auditEvent\.findMany\(\{[\s\S]*?entityType:\s*"onboarding_drip"/);
  });

  it("monthly-report batches the ClientReport dedup lookup", () => {
    const src = readRoute("app/api/cron/monthly-report/route.ts");
    expect(src).toMatch(/clientReport\.findMany\(\{[\s\S]*?kind:\s*"monthly"/);
  });

  it("weekly-report batches the ClientReport dedup lookup", () => {
    const src = readRoute("app/api/cron/weekly-report/route.ts");
    expect(src).toMatch(/clientReport\.findMany\(\{[\s\S]*?kind:\s*"weekly"/);
  });
});
