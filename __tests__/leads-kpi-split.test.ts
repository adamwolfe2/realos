// Leads KPI: keep the headline, credit honestly (Adam, 2026-10-22): "35
// captured by LeaseStack · 45 from AppFolio applications".
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { leadsSplitNote } from "@/lib/reports/leads-split";

describe("leadsSplitNote", () => {
  it("splits captured vs AppFolio-application leads", () => {
    expect(leadsSplitNote({ leads: 80, leadsFromAppfolio: 45, leadsCaptured: 35 })).toBe(
      "35 captured by LeaseStack · 45 from AppFolio applications",
    );
  });
  it("is null with no AppFolio leads or on snapshots that predate the field", () => {
    expect(leadsSplitNote({ leads: 80, leadsFromAppfolio: 0, leadsCaptured: 80 })).toBeNull();
    expect(leadsSplitNote({ leads: 80 })).toBeNull();
    expect(leadsSplitNote({ leads: 80, leadsFromAppfolio: 45 })).toBeNull();
  });
  it("counts captured leads instead of inferring them; other imports show as other", () => {
    expect(leadsSplitNote({ leads: 80, leadsFromAppfolio: 40, leadsCaptured: 30 })).toBe(
      "30 captured by LeaseStack · 40 from AppFolio applications · 10 other",
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
      kpis: { leads: 80, leadsFromAppfolio: 45, leadsCaptured: 35, tours: 0, applications: 0, costPerLead: null, adSpendUsd: 0, organicSessions: 0 },
      funnel: [], leadSources: [], adPerformance: [], topPages: [], topQueries: [],
      insights: [], properties: [], attribution: [], competitors: [],
      kpiDeltas: { leadsPct: null, toursPct: null, applicationsPct: null, costPerLeadPct: null, adSpendUsdPct: null, organicSessionsPct: null },
    };
    const { html, text } = buildReportEmail({
      snapshot: snapshot as never,
      orgName: "SG Real Estate",
      shareUrl: "https://example.com/r/x",
    } as never);
    expect(html).toContain("35 captured by LeaseStack · 45 from AppFolio applications");
    expect(text).toContain("35 captured by LeaseStack · 45 from AppFolio applications");
  });
});

describe("one-pager figure", () => {
  it("renders the note even when a delta is shown", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("components/portal/reports/one-pager-blocks.tsx", "utf8");
    expect(src).not.toMatch(/\) : f\.note \?/);
  });
});
