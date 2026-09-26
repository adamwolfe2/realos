import { describe, it, expect } from "vitest";
import { orderOrgsForAeoScan } from "../lib/aeo/scan-order";

const DAY = 86_400_000;
const NOW = 100 * DAY;

describe("orderOrgsForAeoScan", () => {
  it("puts a paying org due a weekly scan ahead of never-scanned trials", () => {
    const orgs = [
      { id: "trial-never", subscriptionStatus: "TRIALING" },
      { id: "paying", subscriptionStatus: "ACTIVE" },
      { id: "trial-old", subscriptionStatus: "TRIALING" },
    ];
    const last = new Map([["paying", NOW - 7 * DAY], ["trial-old", NOW - 30 * DAY]]);
    expect(orderOrgsForAeoScan(orgs, last, NOW).map((o) => o.id)).toEqual([
      "paying",
      "trial-never",
      "trial-old",
    ]);
  });

  it("a paying org scanned this week falls back to stalest-first", () => {
    const orgs = [
      { id: "paying", subscriptionStatus: "ACTIVE" },
      { id: "trial", subscriptionStatus: "TRIALING" },
    ];
    const last = new Map([["paying", NOW - 2 * DAY], ["trial", NOW - 9 * DAY]]);
    expect(orderOrgsForAeoScan(orgs, last, NOW).map((o) => o.id)).toEqual(["trial", "paying"]);
  });
});
