// Leads KPI: keep the headline, credit honestly (Adam, 2026-10-22): "35
// captured by LeaseStack · 45 from AppFolio applications".
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { leadsSplitNote } from "@/lib/reports/leads-split";

describe("leadsSplitNote", () => {
  it("splits captured vs AppFolio-application leads", () => {
    expect(leadsSplitNote({ leads: 80, leadsFromAppfolio: 45 })).toBe(
      "35 captured by LeaseStack · 45 from AppFolio applications",
    );
  });
  it("is null with no AppFolio leads or on snapshots that predate the field", () => {
    expect(leadsSplitNote({ leads: 80, leadsFromAppfolio: 0 })).toBeNull();
    expect(leadsSplitNote({ leads: 80 })).toBeNull();
  });
  it("never goes negative", () => {
    expect(leadsSplitNote({ leads: 3, leadsFromAppfolio: 5 })).toBe(
      "0 captured by LeaseStack · 5 from AppFolio applications",
    );
  });
});

describe("report email Leads cell", () => {
  it("renders the split under the Leads figure", async () => {
    const { buildReportEmail } = await import("@/lib/email/report-email");
    const snapshot = {
      kind: "custom",
      periodStart: "2026-07-19T00:00:00.000Z",
      periodEnd: "2026-10-20T00:00:00.000Z",
      kpis: { leads: 80, leadsFromAppfolio: 45, tours: 0, applications: 0, costPerLead: null, adSpendUsd: 0, organicSessions: 0 },
      funnel: [], leadSources: [], adPerformance: [], topPages: [], topQueries: [],
      insights: [], properties: [], attribution: [], competitors: [],
      kpiDeltas: { leadsPct: null, toursPct: null, applicationsPct: null, costPerLeadPct: null, adSpendUsdPct: null, organicSessionsPct: null },
    };
    const { html } = buildReportEmail({
      snapshot: snapshot as never,
      orgName: "SG Real Estate",
      shareUrl: "https://example.com/r/x",
    } as never);
    expect(html).toContain("35 captured by LeaseStack · 45 from AppFolio applications");
  });
});
