import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Multi-property recipients + naming for report/digest emails (2026-11).
// One org, two ACTIVE properties A and B; a property-restricted member has
// a UserPropertyAccess grant for A only.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  send: vi.fn(async () => ({ data: { id: "m" }, error: null })),
  getOpenInsights: vi.fn(),
  getInsightCounts: vi.fn(),
  buildWeeklyDigest: vi.fn(),
  db: {
    organization: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: async (_n: string, job: () => Promise<{ result: unknown }>) =>
    (await job()).result,
}));
vi.mock("@/lib/email/shared", async (orig) => ({
  ...(await orig<typeof import("@/lib/email/shared")>()),
  getResend: () => ({ emails: { send: h.send } }),
}));
vi.mock("@/lib/insights/queries", () => ({
  getOpenInsights: h.getOpenInsights,
  getInsightCounts: h.getInsightCounts,
}));
vi.mock("@/lib/reports/weekly-digest", () => ({
  buildWeeklyDigest: h.buildWeeklyDigest,
}));

const { digestAudiences } = await import("@/lib/email/digest-audiences");
const { buildReportEmail } = await import("@/lib/email/report-email");
const dailyDigest = await import("@/app/api/cron/daily-insight-digest/route");
const weeklyDigest = await import("@/app/api/cron/weekly-digest/route");

const req = () => new Request("http://x") as never;

const insight = (id: string, propertyName: string) => ({
  id,
  severity: "warning",
  category: "traffic",
  title: `${propertyName} alert`,
  body: "",
  suggestedAction: null,
  href: null,
  property: { name: propertyName },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("digestAudiences", () => {
  it("splits unrestricted members from property-restricted members", () => {
    const out = digestAudiences([
      { email: "owner@x.co", propertyAccessRestricted: false, propertyAccess: [] },
      { email: "a-only@x.co", propertyAccessRestricted: true, propertyAccess: [{ propertyId: "prop-a" }] },
      { email: "a-too@x.co", propertyAccessRestricted: true, propertyAccess: [{ propertyId: "prop-a" }] },
      { email: "bad", propertyAccessRestricted: false, propertyAccess: [] },
      // Restricted seat that lost every grant: no digest at all.
      { email: "locked-out@x.co", propertyAccessRestricted: true, propertyAccess: [] },
    ]);
    expect(out).toEqual([
      { propertyIds: null, emails: ["owner@x.co"] },
      { propertyIds: ["prop-a"], emails: ["a-only@x.co", "a-too@x.co"] },
    ]);
  });
});

describe("daily-insight-digest with two properties", () => {
  it("a member restricted to A gets only A's insights; never B's", async () => {
    h.db.organization.findMany.mockResolvedValue([{ id: "org-1", name: "SG" }]);
    h.db.user.findMany.mockResolvedValue([
      { email: "owner@x.co", propertyAccess: [] },
      { email: "a-only@x.co", propertyAccess: [{ propertyId: "prop-a" }] },
    ]);
    h.getInsightCounts.mockImplementation(async () => ({
      critical: 0, warning: 1, info: 0, total: 1,
    }));
    h.getOpenInsights.mockImplementation(
      async (_org: string, opts: { propertyIds?: string[] }) =>
        opts.propertyIds
          ? [insight("i-a", "A House")]
          : [insight("i-a", "A House"), insight("i-b", "B Lofts")],
    );

    await dailyDigest.GET(req());

    // The restricted audience's queries are scoped to its grant.
    expect(h.getOpenInsights).toHaveBeenCalledWith("org-1", {
      propertyIds: ["prop-a"],
      limit: 5,
    });
    expect(h.getInsightCounts).toHaveBeenCalledWith("org-1", {
      propertyIds: ["prop-a"],
    });

    const mails = (h.send.mock.calls as unknown as Array<[{ to: string; html: string }]>).map(([m]) => m);
    const restricted = mails.find((m) => m.to === "a-only@x.co");
    const owner = mails.find((m) => m.to === "owner@x.co");
    expect(restricted?.html).toContain("A House");
    expect(restricted?.html).not.toContain("B Lofts");
    expect(owner?.html).toContain("B Lofts");
  });
});

describe("weekly-digest with a property-restricted seat", () => {
  it("restricted seat gets a digest scoped to its grant; others get the org-wide digest", async () => {
    h.db.organization.findMany.mockResolvedValue([
      { id: "org-1", name: "SG", reportAutoSend: true },
    ]);
    h.db.user.findMany.mockResolvedValue([
      { email: "owner@x.co", propertyAccess: [] },
      { email: "a-only@x.co", propertyAccess: [{ propertyId: "prop-a" }] },
    ]);
    h.buildWeeklyDigest.mockImplementation(
      async (_org: string, opts: { propertyIds?: string[] } = {}) => ({
        hasData: true,
        orgId: "org-1",
        orgName: opts.propertyIds ? "SCOPED-A" : "ORG-WIDE",
        weekLabel: "Nov 1",
        metrics: {
          leadsThisWeek: 1, leadsDelta: 0, toursThisWeek: 0, toursDelta: 0,
          applicationsThisWeek: 0, adSpendCents: 0, organicSessions: 0,
        },
        topProperties: [],
        leadSources: { rows: [], untracked: 0 },
        openInsights: 0,
        unreadLeads: 0,
        seo: {
          avgScoreThisWeek: null, avgScoreLastWeek: null, scoreDelta: null,
          openRecsCritical: 0, openRecsHigh: 0, topRecommendations: [], pendingDrafts: 0,
        },
      }),
    );

    await weeklyDigest.GET(req());

    expect(h.buildWeeklyDigest).toHaveBeenCalledWith("org-1", {});
    expect(h.buildWeeklyDigest).toHaveBeenCalledWith("org-1", { propertyIds: ["prop-a"] });
    const mails = (h.send.mock.calls as unknown as Array<[{ to: string; html: string }]>).map(([m]) => m);
    expect(mails.find((m) => m.to === "a-only@x.co")?.html).toContain("SCOPED-A");
    expect(mails.find((m) => m.to === "a-only@x.co")?.html).not.toContain("ORG-WIDE");
    expect(mails.find((m) => m.to === "owner@x.co")?.html).toContain("ORG-WIDE");
  });
});

describe("buildReportEmail naming", () => {
  const snapshot = (scope: { propertyId: string | null; propertyName: string | null }) =>
    ({
      kind: "monthly",
      scope: { ...scope, propertySlug: null },
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-10-31T00:00:00.000Z",
      kpis: { leads: 3, tours: 0, applications: 0, costPerLead: null, adSpendUsd: 0, organicSessions: 0 },
      kpiDeltas: {
        leadsPct: null, toursPct: null, applicationsPct: null,
        costPerLeadPct: null, adSpendUsdPct: null, organicSessionsPct: null,
      },
      funnel: [],
      leadSources: [],
      topPages: [],
      topQueries: [],
      insights: [],
      adPerformance: [],
      properties: [],
      chatbotStats: { conversations: 0, leadsFromChat: 0, avgMessageCount: 0 },
    }) as never;

  it("names a property-scoped report for its building, so A's and B's emails differ", () => {
    const a = buildReportEmail({
      orgName: "SG Real Estate",
      snapshot: snapshot({ propertyId: "prop-a", propertyName: "A House" }),
      shareUrl: "https://x/r/a",
    });
    const b = buildReportEmail({
      orgName: "SG Real Estate",
      snapshot: snapshot({ propertyId: "prop-b", propertyName: "B Lofts" }),
      shareUrl: "https://x/r/b",
    });
    expect(a.subject).toContain("A House");
    expect(b.subject).toContain("B Lofts");
    expect(a.text).toContain("A House");
    expect(a.html).toContain("A House");
  });

  it("keeps the org name on an org-wide report", () => {
    const r = buildReportEmail({
      orgName: "SG Real Estate",
      snapshot: snapshot({ propertyId: null, propertyName: null }),
      shareUrl: "https://x/r/o",
    });
    expect(r.subject).toContain("SG Real Estate");
  });
});
