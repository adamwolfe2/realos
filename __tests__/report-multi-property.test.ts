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

  it("property-scoped report never charts org-wide SeoSnapshot clicks (sibling data)", async () => {
    mockPrisma.property.findFirst.mockImplementation(async () => ({
      id: "prop-b",
      slug: "b-house",
      name: "B House",
    }));
    try {
      await generateReportSnapshot("org-1", "weekly", {
        skipAi: true,
        now: NOW,
        propertyId: "prop-b",
      });
    } finally {
      mockPrisma.property.findFirst.mockImplementation(async () => null);
    }
    expect(mockPrisma.seoSnapshot.findMany).not.toHaveBeenCalled();
    const byDate = mockPrisma.seoQuery.groupBy.mock.calls.find(
      ([args]: [{ by: string[] }]) => args.by.includes("date"),
    );
    expect(byDate).toBeDefined();
    // Scoped by the property's query patterns, not the whole org.
    expect(byDate[0].where.OR ?? byDate[0].where.query).toBeDefined();
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
  it("one bound domain: unchanged (the org's site is the property's)", () => {
    expect(reportDomainsForProperty(["a.com"], null)).toEqual(["a.com"]);
  });
  it("two bound domains: only the one matching the property's websiteUrl", () => {
    expect(reportDomainsForProperty(["a.com", "www.b.com"], "https://b.com/rooms")).toEqual(["www.b.com"]);
    expect(reportDomainsForProperty(["a.com", "b.com"], "a.com")).toEqual(["a.com"]);
  });
  it("two bound domains, no or unparseable websiteUrl: none", () => {
    expect(reportDomainsForProperty(["a.com", "b.com"], null)).toEqual([]);
    expect(reportDomainsForProperty(["a.com", "b.com"], "http://")).toEqual([]);
  });

  it("B's property report no longer matches A's domain in its SEO clauses", async () => {
    mockPrisma.property.findFirst.mockImplementation(async () => ({
      id: "prop-b",
      slug: "b-lofts",
      name: "B Lofts",
      websiteUrl: "https://blofts.com",
    }));
    mockPrisma.domainBinding.findMany.mockImplementation(async () => [
      { hostname: "ahouse.com" },
      { hostname: "blofts.com" },
    ]);
    mockPrisma.property.count.mockImplementation(async () => 2);
    try {
      await generateReportSnapshot("org-1", "weekly", { skipAi: true, now: NOW, propertyId: "prop-b" });
    } finally {
      mockPrisma.property.findFirst.mockImplementation(async () => null);
      mockPrisma.domainBinding.findMany.mockImplementation(async () => []);
      mockPrisma.property.count.mockImplementation(async () => 0);
    }
    const [args] = mockPrisma.seoLandingPage.groupBy.mock.calls.find(
      ([a]: [{ by: string[] }]) => a.by.includes("url"),
    );
    const clause = JSON.stringify(args.where);
    expect(clause).toContain("blofts.com");
    expect(clause).not.toContain("ahouse.com");
  });
});
