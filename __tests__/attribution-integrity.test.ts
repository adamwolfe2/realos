import { describe, it, expect } from "vitest";
import { backfillPropertyId } from "@/lib/tenancy/property-filter";

// ---------------------------------------------------------------------------
// Guard for the 2026-07-29 attribution-integrity slice: writes must backfill
// a building but never re-file a lead that already belongs to one.
// ---------------------------------------------------------------------------

describe("backfillPropertyId — backfill only, never re-file", () => {
  it("backfills when the row has no building yet", () => {
    expect(backfillPropertyId(null, "prop_a")).toBe("prop_a");
  });

  it("keeps the existing building when a different one arrives", () => {
    // The regression that matters: a person browsing building B's site must
    // not drag an existing building-A lead across to B mid-pipeline.
    expect(backfillPropertyId("prop_a", "prop_b")).toBe("prop_a");
  });

  it("returns undefined when neither side knows a building", () => {
    // undefined (not null) so Prisma omits the column instead of nulling it.
    expect(backfillPropertyId(null, null)).toBeUndefined();
    expect(backfillPropertyId(undefined, undefined)).toBeUndefined();
  });

  it("is a no-op write when only the existing value is known", () => {
    expect(backfillPropertyId("prop_a", null)).toBe("prop_a");
  });
});
