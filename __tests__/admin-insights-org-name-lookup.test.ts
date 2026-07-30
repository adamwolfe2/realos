import { describe, it, expect } from "vitest";
import { orgIdsNeedingNameLookup } from "@/app/admin/insights/page";

// ---------------------------------------------------------------------------
// Regression for ADMIN-OPS-D003: "Most on fire" org names were looked up in
// a Map built from the (severity/org-filtered, 200-row-capped) `insights`
// list. An org ranking highly on TOTAL insight count could have zero rows in
// that filtered list and rendered as "Unknown". The name lookup must target
// every ranked org id directly, independent of any list filtering.
// ---------------------------------------------------------------------------

describe("orgIdsNeedingNameLookup (ADMIN-OPS-D003)", () => {
  it("includes every org id from the ranking list", () => {
    const ids = orgIdsNeedingNameLookup(
      [{ orgId: "org_a" }, { orgId: "org_b" }, { orgId: "org_c" }],
      undefined,
    );
    expect(ids).toEqual(expect.arrayContaining(["org_a", "org_b", "org_c"]));
    expect(ids).toHaveLength(3);
  });

  it("also includes the current org filter even if it's not in the top rankings", () => {
    const ids = orgIdsNeedingNameLookup(
      [{ orgId: "org_a" }],
      "org_filtered_out_of_top_8",
    );
    expect(ids).toContain("org_a");
    expect(ids).toContain("org_filtered_out_of_top_8");
  });

  it("de-dupes when the org filter is already in the rankings", () => {
    const ids = orgIdsNeedingNameLookup([{ orgId: "org_a" }], "org_a");
    expect(ids).toEqual(["org_a"]);
  });

  it("returns an empty list when there are no rankings and no filter", () => {
    expect(orgIdsNeedingNameLookup([], undefined)).toEqual([]);
  });
});
