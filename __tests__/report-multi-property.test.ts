import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Multi-property correctness for generateReportSnapshot (2026-11). One org,
// two ACTIVE properties (A and B). Every assertion below failed before the
// fix in lib/reports/generate.ts.
// Auto-mock copied from report-active-property-lead-clause.test.ts.
// ---------------------------------------------------------------------------

function autoMockPrisma() {
  const defaultFor = (method: string) => {
    switch (method) {
      case "count":
        return vi.fn(async () => 0);
      case "$queryRaw":
      case "$queryRawUnsafe":
        // Root-level prisma methods, not models — must be callable or a
        // Promise.all throws and every query after the raw call silently
        // never registers (the caller swallows it).
        return vi.fn(async () => [{ count: BigInt(0) }]);
      case "aggregate":
        return vi.fn(async () => ({ _sum: {}, _avg: {}, _count: { _all: 0 } }));
      case "groupBy":
        return vi.fn(async () => []);
      case "findMany":
        return vi.fn(async () => []);
      default:
        // findFirst / findUnique / anything else this file might add later.
        return vi.fn(async () => null);
    }
  };
  return new Proxy(
    {} as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
    {
      get(models, model: string) {
        // prisma.$queryRaw / $queryRawUnsafe are functions on the client
        // root, not models — return the fn directly instead of a model
        // proxy (which isn't callable).
        if (model.startsWith("$")) {
          if (!(model in models)) {
            models[model] = defaultFor(model) as unknown as Record<
              string,
              ReturnType<typeof vi.fn>
            >;
          }
          return models[model];
        }
        if (!(model in models)) {
          models[model] = new Proxy(
            {} as Record<string, ReturnType<typeof vi.fn>>,
            {
              get(methods, method: string) {
                if (!(method in methods)) methods[method] = defaultFor(method);
                return methods[method];
              },
            },
          );
        }
        return models[model];
      },
    },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = autoMockPrisma();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

const { generateReportSnapshot, reportSubjectName, reportDomainsForProperty } = await import(
  "@/lib/reports/generate"
);

const D1 = new Date("2026-10-20T00:00:00.000Z");
const NOW = new Date("2026-10-27T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.insight.findMany.mockImplementation(async () => []);
  mockPrisma.seoSnapshot.findMany.mockImplementation(async () => []);
  mockPrisma.property.findMany.mockImplementation(async () => []);
});

describe("generateReportSnapshot with two ACTIVE properties", () => {
  it("org-wide property table lists ACTIVE properties only", async () => {
    await generateReportSnapshot("org-1", "weekly", { skipAi: true, now: NOW });
    const rollup = mockPrisma.property.findMany.mock.calls.find(
      ([args]: [{ take?: number }]) => args.take === 20,
    );
    expect(rollup).toBeDefined();
    expect(rollup[0].where).toEqual({ orgId: "org-1", lifecycle: "ACTIVE" });
  });

  it("org-wide insights keep one row per (kind, property): A's alert does not hide B's", async () => {
    mockPrisma.insight.findMany.mockImplementation(async (args: { distinct?: string[] }) =>
      args.distinct
        ? [
            { id: "i-a", kind: "vacancy_needs_boost", severity: "warning", title: "A vacancy", body: "", createdAt: D1 },
            { id: "i-b", kind: "vacancy_needs_boost", severity: "warning", title: "B vacancy", body: "", createdAt: D1 },
          ]
        : [],
    );
    // Two ACTIVE properties (buildScope's take:2 probe).
    mockPrisma.property.findMany.mockImplementation(async (args: { take?: number }) =>
      args.take === 2 ? [{ id: "prop-a", slug: "a", name: "A" }, { id: "prop-b", slug: "b", name: "B" }] : [],
    );
    const snap = await generateReportSnapshot("org-1", "weekly", { skipAi: true, now: NOW });
    const call = mockPrisma.insight.findMany.mock.calls.find(
      ([args]: [{ distinct?: string[] }]) => args.distinct,
    );
    expect(call[0].distinct).toEqual(["kind", "propertyId"]);
    expect(call[0].where.OR).toEqual([
      { propertyId: null },
      { property: { lifecycle: "ACTIVE" } },
    ]);
    expect(snap.insights.map((i) => i.id).sort()).toEqual(["i-a", "i-b"]);
  });

  it("org-wide organic sessions do not double count a date that has both an org row and property rows", async () => {
    mockPrisma.seoSnapshot.findMany.mockImplementation(async () => [
      // Legacy org-wide row for D1, superseded by A's and B's own rows.
      { date: D1, propertyId: null, organicSessions: 100, totalClicks: 10 },
      { date: D1, propertyId: "prop-a", organicSessions: 60, totalClicks: 6 },
      { date: D1, propertyId: "prop-b", organicSessions: 40, totalClicks: 4 },
    ]);
    const snap = await generateReportSnapshot("org-1", "weekly", { skipAi: true, now: NOW });
    expect(snap.kpis.organicSessions).toBe(100);
    const [args] = mockPrisma.seoSnapshot.findMany.mock.calls[0];
    expect(args.where.OR).toEqual([
      { propertyId: null },
      { property: { lifecycle: "ACTIVE" } },
    ]);
  });

  it("property-scoped organic visits match the property page (own SeoSnapshot rows, larger of sessions and clicks)", async () => {
    // Regression: SG snapshot read 0 visits (URL-pattern match dropped GA4's
    // relative paths) while the property page showed 235.
    mockPrisma.property.findFirst.mockImplementation(async () => ({
      id: "prop-b",
      slug: "b-house",
      name: "B House",
    }));
    mockPrisma.property.count.mockImplementation(async () => 2);
    mockPrisma.seoSnapshot.findMany.mockImplementation(async () => [
      { date: new Date("2026-10-21T00:00:00.000Z"), propertyId: "prop-b", organicSessions: 12, totalClicks: 30 },
      { date: new Date("2026-10-22T00:00:00.000Z"), propertyId: "prop-b", organicSessions: 0, totalClicks: 0 },
      { date: new Date("2026-10-23T00:00:00.000Z"), propertyId: "prop-b", organicSessions: 50, totalClicks: 8 },
    ]);
    let snap;
    try {
      snap = await generateReportSnapshot("org-1", "weekly", {
        skipAi: true,
        now: NOW,
        propertyId: "prop-b",
      });
    } finally {
      mockPrisma.property.findFirst.mockImplementation(async () => null);
      mockPrisma.property.count.mockImplementation(async () => 0);
      mockPrisma.seoSnapshot.findMany.mockImplementation(async () => []);
    }
    expect(snap.kpis.organicSessions).toBe(80);
  });

  it("property-scoped reputation shows the property's Google rating, not the mention average", async () => {
    // Regression: SG snapshot read 5.0 / 50 (mention average) while the
    // property page showed Google's 4.0 / 49.
    mockPrisma.property.findFirst.mockImplementation(async () => ({
      id: "prop-b",
      slug: "b-house",
      name: "B House",
    }));
    mockPrisma.property.count.mockImplementation(async () => 2);
    mockPrisma.property.findMany.mockImplementation(async (args: { where?: { id?: string } }) =>
      args.where?.id === "prop-b" ? [{ googleAggRating: 4, googleAggReviewCount: 49 }] : [],
    );
    mockPrisma.propertyMention.aggregate.mockImplementation(async () => ({
      _avg: { rating: 5 },
      _count: { _all: 50 },
    }));
    let snap;
    try {
      snap = await generateReportSnapshot("org-1", "weekly", {
        skipAi: true,
        now: NOW,
        propertyId: "prop-b",
      });
    } finally {
      mockPrisma.property.findFirst.mockImplementation(async () => null);
      mockPrisma.property.count.mockImplementation(async () => 0);
      mockPrisma.propertyMention.aggregate.mockImplementation(async () => ({
        _sum: {},
        _avg: {},
        _count: { _all: 0 },
      }));
    }
    expect(snap.reputationStats?.overallRating).toBe(4);
    expect(snap.reputationStats?.totalReviews).toBe(49);
  });

  it("property with a Google rating but no stored mentions still gets reputation stats", async () => {
    mockPrisma.property.findFirst.mockImplementation(async () => ({ id: "prop-b", slug: "b-house", name: "B House" }));
    mockPrisma.property.count.mockImplementation(async () => 2);
    mockPrisma.property.findMany.mockImplementation(async (args: { where?: { id?: string } }) =>
      args.where?.id === "prop-b" ? [{ googleAggRating: 4.3, googleAggReviewCount: 12 }] : [],
    );
    let snap;
    try {
      snap = await generateReportSnapshot("org-1", "weekly", { skipAi: true, now: NOW, propertyId: "prop-b" });
    } finally {
      mockPrisma.property.findFirst.mockImplementation(async () => null);
      mockPrisma.property.count.mockImplementation(async () => 0);
    }
    expect(snap.reputationStats?.overallRating).toBe(4.3);
    expect(snap.reputationStats?.totalReviews).toBe(12);
  });

  it("property-scoped report never charts org-wide SeoSnapshot clicks (sibling data)", async () => {
    mockPrisma.property.findFirst.mockImplementation(async () => ({
      id: "prop-b",
      slug: "b-house",
      name: "B House",
    }));
    mockPrisma.property.count.mockImplementation(async () => 2);
    try {
      await generateReportSnapshot("org-1", "weekly", {
        skipAi: true,
        now: NOW,
        propertyId: "prop-b",
      });
    } finally {
      mockPrisma.property.findFirst.mockImplementation(async () => null);
      mockPrisma.property.count.mockImplementation(async () => 0);
    }
    // Only the property's own rows may be read, never org-wide or siblings.
    for (const [args] of mockPrisma.seoSnapshot.findMany.mock.calls) {
      expect(args.where.propertyId).toBe("prop-b");
    }
    const byDate = mockPrisma.seoQuery.groupBy.mock.calls.find(
      ([args]: [{ by: string[] }]) => args.by.includes("date"),
    );
    expect(byDate).toBeDefined();
    // Scoped by the property's query patterns, not the whole org.
    expect(byDate[0].where.OR ?? byDate[0].where.query).toBeDefined();
  });
});

describe("one ACTIVE property (+ EXCLUDED rows): multi-property-only behaviour stays off", () => {
  it("org-wide insights keep origin/main's one-row-per-kind dedupe", async () => {
    mockPrisma.property.findMany.mockImplementation(async (args: { take?: number }) =>
      args.take === 2 ? [{ id: "tc", slug: "tc", name: "TC", websiteUrl: null }] : [],
    );
    await generateReportSnapshot("org-1", "weekly", { skipAi: true, now: NOW });
    const call = mockPrisma.insight.findMany.mock.calls.find(
      ([args]: [{ distinct?: string[] }]) => args.distinct,
    );
    expect(call[0].distinct).toEqual(["kind"]);
    expect(call[0].orderBy).toEqual([{ kind: "asc" }, { createdAt: "desc" }]);
  });

  it("property-scoped report keeps origin/main's SeoSnapshot clicks series (the org's site is the property's)", async () => {
    mockPrisma.property.findFirst.mockImplementation(async () => ({
      id: "tc", slug: "tc", name: "TC", websiteUrl: null,
    }));
    mockPrisma.property.count.mockImplementation(async () => 1);
    try {
      await generateReportSnapshot("org-1", "weekly", { skipAi: true, now: NOW, propertyId: "tc" });
    } finally {
      mockPrisma.property.findFirst.mockImplementation(async () => null);
      mockPrisma.property.count.mockImplementation(async () => 0);
    }
    const orgCall = mockPrisma.seoSnapshot.findMany.mock.calls.find(
      ([a]: [{ where: Record<string, unknown> }]) => !("propertyId" in a.where),
    );
    expect(orgCall[0].where).toEqual({ orgId: "org-1", date: expect.any(Object) });
    const byDate = mockPrisma.seoQuery.groupBy.mock.calls.find(
      ([a]: [{ by: string[] }]) => a.by.includes("date"),
    );
    expect(byDate).toBeUndefined();
  });
});

describe("reportSubjectName (AI narrative subject)", () => {
  const props = [
    { id: "a", name: "A House", leads: 3, occupancyPct: null },
    { id: "b", name: "B Lofts", leads: 2, occupancyPct: null },
  ];
  it("names a property-scoped report's building", () => {
    expect(
      reportSubjectName({
        scope: { propertyId: "a", propertyName: "A House", propertySlug: "a" },
        properties: [props[0]],
      }),
    ).toBe("A House");
  });
  it("calls a 2-property org-wide report a portfolio and lists both buildings", () => {
    const s = reportSubjectName({
      scope: { propertyId: null, propertyName: null, propertySlug: null },
      properties: props,
    });
    expect(s).toContain("portfolio of 2 properties");
    expect(s).toContain("A House");
    expect(s).toContain("B Lofts");
  });
  it("keeps the single-property wording unchanged", () => {
    expect(
      reportSubjectName({
        scope: { propertyId: null, propertyName: null, propertySlug: null },
        properties: [props[0]],
      }),
    ).toBe("the property");
  });
});

describe("report domain patterns per property", () => {
  // Gate = number of ACTIVE properties, never the number of bound domains.
  it("one ACTIVE property: every bound domain is kept, whatever websiteUrl says", () => {
    expect(reportDomainsForProperty(["tc.com", "www.tc.com"], null, 1)).toEqual(["tc.com", "www.tc.com"]);
    expect(reportDomainsForProperty(["tc.com", "www.tc.com"], "https://other.com", 1)).toEqual(["tc.com", "www.tc.com"]);
  });
  it("2+ ACTIVE properties: only the domain matching the property's websiteUrl", () => {
    expect(reportDomainsForProperty(["a.com", "www.b.com"], "https://b.com/rooms", 2)).toEqual(["www.b.com"]);
    expect(reportDomainsForProperty(["a.com", "b.com"], "https://a.com", 2)).toEqual(["a.com"]);
  });
  it("2+ ACTIVE: scheme-less, www/apex, case and trailing slash all match", () => {
    expect(reportDomainsForProperty(["a.com", "B.com/"], "WWW.b.com/", 3)).toEqual(["B.com/"]);
    expect(reportDomainsForProperty(["a.com", "https://www.b.com"], "b.com", 2)).toEqual(["https://www.b.com"]);
  });
  it("2+ ACTIVE, no or unparseable websiteUrl: none", () => {
    expect(reportDomainsForProperty(["a.com", "b.com"], null, 2)).toEqual([]);
    expect(reportDomainsForProperty(["a.com", "b.com"], "http://", 2)).toEqual([]);
  });

  const runScoped = async (
    property: { id: string; slug: string; name: string; websiteUrl: string | null },
    activeCount: number,
    hostnames: string[],
  ) => {
    mockPrisma.property.findFirst.mockImplementation(async () => property);
    mockPrisma.domainBinding.findMany.mockImplementation(async () => hostnames.map((hostname) => ({ hostname })));
    mockPrisma.property.count.mockImplementation(async () => activeCount);
    try {
      await generateReportSnapshot("org-1", "weekly", { skipAi: true, now: NOW, propertyId: property.id });
    } finally {
      mockPrisma.property.findFirst.mockImplementation(async () => null);
      mockPrisma.domainBinding.findMany.mockImplementation(async () => []);
      mockPrisma.property.count.mockImplementation(async () => 0);
    }
    const [args] = mockPrisma.seoLandingPage.groupBy.mock.calls
      .filter(([a]: [{ by: string[] }]) => a.by.includes("url"))
      .at(-1);
    return JSON.stringify(args.where);
  };

  it("(a) one ACTIVE property (+ EXCLUDED rows) with apex + www bindings and null websiteUrl keeps both domains", async () => {
    // count is ACTIVE-only; the EXCLUDED rows never reach it.
    const clause = await runScoped(
      { id: "tc", slug: "telegraph-commons", name: "Telegraph Commons", websiteUrl: null },
      1,
      ["telegraphcommons.com", "www.telegraphcommons.com"],
    );
    expect(clause).toContain('"telegraphcommons.com"');
    expect(clause).toContain("www.telegraphcommons.com");
    const [countArgs] = mockPrisma.property.count.mock.calls.at(-1);
    expect(countArgs.where).toEqual({ orgId: "org-1", lifecycle: "ACTIVE" });
  });

  it("(a) org-wide report, one ACTIVE property, apex + www, null websiteUrl: both domains kept", async () => {
    mockPrisma.property.findMany.mockImplementation(async (args: { take?: number }) =>
      args.take === 2 ? [{ id: "tc", slug: "telegraph-commons", name: "Telegraph Commons", websiteUrl: null }] : [],
    );
    mockPrisma.domainBinding.findMany.mockImplementation(async () => [
      { hostname: "telegraphcommons.com" },
      { hostname: "www.telegraphcommons.com" },
    ]);
    try {
      await generateReportSnapshot("org-1", "weekly", { skipAi: true, now: NOW });
    } finally {
      mockPrisma.domainBinding.findMany.mockImplementation(async () => []);
    }
    const [args] = mockPrisma.seoLandingPage.groupBy.mock.calls.find(
      ([a]: [{ by: string[] }]) => a.by.includes("url"),
    );
    const clause = JSON.stringify(args.where);
    expect(clause).toContain('"telegraphcommons.com"');
    expect(clause).toContain("www.telegraphcommons.com");
  });

  it("(b) two ACTIVE properties on their own domains: each report uses only its own", async () => {
    const hosts = ["ahouse.com", "blofts.com"];
    const b = await runScoped({ id: "pb", slug: "b-lofts", name: "B Lofts", websiteUrl: "https://blofts.com" }, 2, hosts);
    expect(b).toContain("blofts.com");
    expect(b).not.toContain("ahouse.com");
    const a = await runScoped({ id: "pa", slug: "a-house", name: "A House", websiteUrl: "https://ahouse.com" }, 2, hosts);
    expect(a).toContain("ahouse.com");
    expect(a).not.toContain("blofts.com");
  });

  it("(c) scheme-less websiteUrl matches its binding", async () => {
    const b = await runScoped({ id: "pb", slug: "b-lofts", name: "B Lofts", websiteUrl: "www.BLofts.com/" }, 2, ["ahouse.com", "blofts.com"]);
    expect(b).toContain("blofts.com");
    expect(b).not.toContain("ahouse.com");
  });
});
