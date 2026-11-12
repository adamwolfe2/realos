import { describe, expect, it } from "vitest";
import { summarizeTrafficSources } from "@/lib/attribution/proof-model";

const row = (id: string | null, label: string | null, stage = "New lead", verification = "leasestack_only") =>
  ({ trafficSourceId: id, trafficSourceLabel: label, stage, verification }) as Parameters<
    typeof summarizeTrafficSources
  >[0][number];

describe("summarizeTrafficSources", () => {
  it("groups by channel, counts applied/signed, puts untracked last, skips AppFolio imports", () => {
    const out = summarizeTrafficSources([
      row("zillow", "Zillow", "Applied"),
      row("zillow", "Zillow", "Signed", "verified"),
      row("google_organic", "Google"),
      row(null, null),
      row(null, null),
      row(null, null),
      row("zillow", "Zillow", "Signed", "imported"),
    ]);
    expect(out.map((r) => [r.id, r.leads, r.applied, r.signed])).toEqual([
      ["zillow", 2, 2, 1],
      ["google_organic", 1, 0, 0],
      ["untracked", 3, 0, 0],
    ]);
    expect(out[2].label).toBe("Not tracked");
  });

  it("keeps distinct unknown referrers apart", () => {
    const out = summarizeTrafficSources([row("referral", "berkeley.edu"), row("referral", "yelp.com")]);
    expect(out.map((r) => r.label).sort()).toEqual(["berkeley.edu", "yelp.com"]);
  });
});
