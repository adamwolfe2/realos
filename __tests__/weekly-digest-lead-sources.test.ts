import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildWeeklyDigestEmail } from "@/lib/reports/email-template";
import type { WeeklyDigest } from "@/lib/reports/weekly-digest";

const digest = (leadSources: WeeklyDigest["leadSources"]): WeeklyDigest => ({
  orgName: "SG Real Estate", orgId: "o", weekLabel: "Nov 5 – Nov 12", hasData: true,
  metrics: { leadsThisWeek: 9, leadsDelta: 2, toursThisWeek: 1, toursDelta: 0, applicationsThisWeek: 0, adSpendCents: 0, organicSessions: 0 },
  topProperties: [], leadSources, openInsights: 0, unreadLeads: 0,
  seo: { avgScoreThisWeek: null, avgScoreLastWeek: null, scoreDelta: null, openRecsCritical: 0, openRecsHigh: 0, topRecommendations: [], pendingDrafts: 0 },
});

describe("weekly digest: where leads came from", () => {
  it("lists sources with brand marks and states untracked honestly", () => {
    const html = buildWeeklyDigestEmail(
      digest({ rows: [{ id: "zillow", label: "Zillow", count: 4, reportedByAppfolio: 3 }, { id: "referral", label: "Other websites", count: 1, reportedByAppfolio: 0 }], untracked: 3 }),
      "https://leasestack.co/portal",
    );
    expect(html).toContain("Where leads came from");
    expect(html).toContain('src="https://leasestack.co/logos/sources/zillow.png"');
    expect(html).toContain("Other websites");
    expect(html).not.toContain("logos/sources/referral.png");
    expect(html).toContain("3 more leads have no recorded source");
    expect(html).toContain("(3 per AppFolio)");
  });
  it("omits the section when nothing is tracked yet", () => {
    const html = buildWeeklyDigestEmail(digest({ rows: [], untracked: 5 }), "https://leasestack.co/portal");
    expect(html).not.toContain("Where leads came from");
  });
});
