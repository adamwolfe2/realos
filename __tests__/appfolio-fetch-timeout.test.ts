import { describe, it, expect } from "vitest";
import { timeoutForReport, isTimeout } from "@/lib/integrations/appfolio";

// ---------------------------------------------------------------------------
// The leases phase reported `leasesUpserted: 0` and the warning "leases: The
// operation was aborted due to timeout" on every run for the largest live
// tenant, so signed-lease attribution had no data at all.
//
// Cause: rent_roll is generated on demand and takes longer than the shared
// 30s fetch budget, and a timeout was the ONLY transient failure treated as
// fatal on first occurrence — 429s and 5xx retry, an expired pagination
// cursor restarts the walk, but an abort threw straight out of fetchAllPages.
//
// These pin the two decisions that fix it. Both are pure, so they are cheap
// to keep honest.
// ---------------------------------------------------------------------------

describe("timeoutForReport", () => {
  it("gives rent_roll a longer budget than the default", () => {
    expect(timeoutForReport("rent_roll")).toBeGreaterThan(timeoutForReport("tenant_directory"));
  });

  it("leaves every other report on the default budget", () => {
    const base = timeoutForReport(undefined);
    expect(timeoutForReport("tenant_directory")).toBe(base);
    expect(timeoutForReport("unit_directory")).toBe(base);
    expect(timeoutForReport("rental_applications")).toBe(base);
  });

  it("keeps the slow budget under the 300s function limit with room for a retry", () => {
    // Two attempts plus the other nine phases have to fit in maxDuration=300s.
    expect(timeoutForReport("rent_roll") * 2).toBeLessThan(200_000);
  });

  it("never returns zero or a negative budget", () => {
    for (const r of ["rent_roll", "tenant_directory", "", undefined]) {
      expect(timeoutForReport(r)).toBeGreaterThan(0);
    }
  });
});

describe("isTimeout", () => {
  it("recognises the DOMException AbortSignal.timeout throws", () => {
    expect(isTimeout(new DOMException("The operation was aborted due to timeout", "TimeoutError")))
      .toBe(true);
  });

  it("recognises the message AppFolio surfaced in the live sync warning", () => {
    // Verbatim from lastSyncStats: "leases: The operation was aborted due to timeout"
    expect(isTimeout(new Error("The operation was aborted due to timeout"))).toBe(true);
  });

  it("does NOT treat an ordinary failure as a timeout", () => {
    // A 404 means the report isn't on this tenant's plan. Retrying it wastes
    // the budget that the genuinely-slow reports need.
    expect(isTimeout(new Error("AppFolio showings returned 404"))).toBe(false);
    expect(isTimeout(new Error("401 Unauthorized"))).toBe(false);
    expect(isTimeout(new Error("pagination cursor expired"))).toBe(false);
  });

  it("handles non-Error throwables without blowing up", () => {
    expect(isTimeout("The operation was aborted due to timeout")).toBe(true);
    expect(isTimeout(null)).toBe(false);
    expect(isTimeout(undefined)).toBe(false);
    expect(isTimeout({})).toBe(false);
  });
});
