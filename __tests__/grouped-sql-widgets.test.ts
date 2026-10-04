import { describe, it, expect, vi, beforeEach } from "vitest";

// F-144: dashboard/attribution/property widgets aggregate in Postgres instead
// of fetching every row. These pin the result shaping around the grouped rows
// and the property-clause translation (unsupported shapes must fall back).

const queryRaw = vi.fn();
const convFindMany = vi.fn();
const lpGroupBy = vi.fn();
const sqGroupBy = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/integrations/real-ad-account", () => ({
  realAdAccountWhere: async () => ({}),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: queryRaw,
    chatbotConversation: { findMany: convFindMany },
    domainBinding: { findMany: () => Promise.resolve([]) },
    seoLandingPage: { groupBy: lpGroupBy },
    seoQuery: { groupBy: sqGroupBy },
  },
}));

const { propertyClauseSql } = await import("@/lib/dashboard/property-clause-sql");
const { getConversationsOverTime } = await import("@/lib/dashboard/queries");
const { getLeadsPerModuleTrend, getLeadsPerTouchFrequency } = await import(
  "@/lib/attribution/queries"
);
const { getPropertyTraffic } = await import("@/lib/properties/queries");

beforeEach(() => vi.clearAllMocks());

type SqlArg = { text: string; values: unknown[] };
const lastSql = () => queryRaw.mock.calls[0][0] as SqlArg;
// Tenant + property predicates must reach the SQL, and timestamps must be
// bound as UTC ISO strings cast to plain timestamp (session-TZ independent).
function expectScoped(sql: SqlArg, propertyId: string) {
  const orgIdx = sql.values.indexOf("o") + 1;
  expect(orgIdx).toBeGreaterThan(0);
  expect(sql.text).toContain(`"orgId" = $${orgIdx}`);
  const propIdx = sql.values.indexOf(propertyId) + 1;
  expect(propIdx).toBeGreaterThan(0);
  expect(sql.text).toContain(`"propertyId" = $${propIdx}`);
  expect(sql.text).not.toContain("timestamptz");
  expect(sql.text).toMatch(/\$\d+::timestamp/);
  expect(sql.values.some((v) => typeof v === "string" && /Z$/.test(v))).toBe(true);
}

describe("propertyClauseSql", () => {
  it("translates the property-filter shapes and rejects others", () => {
    expect(propertyClauseSql({})?.text).toBe("");
    expect(propertyClauseSql({ propertyId: "p1" })?.text).toBe(' and "propertyId" = $1');
    const inList = propertyClauseSql({ propertyId: { in: ["a", "b"] } });
    expect(inList?.text).toBe(' and "propertyId" in ($1,$2)');
    expect(inList?.values).toEqual(["a", "b"]);
    expect(
      propertyClauseSql({ OR: [{ propertyId: "a" }, { propertyId: null }] })?.text,
    ).toBe(' and ("propertyId" = $1 or "propertyId" is null)');
    expect(propertyClauseSql({ propertyId: { in: [] } })?.text).toBe(" and false");
    expect(propertyClauseSql({ property: { lifecycle: "ACTIVE" } })).toBeNull();
    expect(propertyClauseSql({ propertyId: { notIn: ["a"] } })).toBeNull();
    expect(propertyClauseSql({ OR: [{ propertyId: "a" }, { orgId: null }] })).toBeNull();
  });
});

describe("getConversationsOverTime", () => {
  it("places grouped days_ago rows at W-1-days_ago and drops out-of-window", async () => {
    queryRaw.mockResolvedValueOnce([
      { days_ago: 0, n: BigInt(4) },
      { days_ago: 6, n: BigInt(2) },
      { days_ago: 7, n: BigInt(9) },
    ]);
    const out = await getConversationsOverTime("o", {
      periodDays: 7,
      propertyClause: { propertyId: "p1" },
    });
    expect(out.map((p) => p.count)).toEqual([2, 0, 0, 0, 0, 0, 4]);
    expect(convFindMany).not.toHaveBeenCalled();
    expectScoped(lastSql(), "p1");
  });

  it("falls back to findMany for an unrecognised clause", async () => {
    convFindMany.mockResolvedValueOnce([{ lastMessageAt: new Date() }]);
    const out = await getConversationsOverTime("o", {
      periodDays: 3,
      propertyClause: { property: { lifecycle: "ACTIVE" } },
    });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(out.map((p) => p.count)).toEqual([0, 0, 1]);
  });
});

describe("attribution grouped helpers", () => {
  const filters = {
    orgId: "o",
    propertyIds: ["p1"],
    fromDate: new Date("2026-09-01T12:00:00Z"),
    toDate: new Date("2026-09-03T12:00:00Z"),
  };

  it("module trend fills every day and labels sources", async () => {
    queryRaw.mockResolvedValueOnce([
      { day: "2026-09-02", source: "CHATBOT", n: BigInt(3) },
      { day: "2026-09-02", source: "FORM", n: BigInt(1) },
      { day: "2026-08-31", source: "FORM", n: BigInt(5) },
    ]);
    const out = await getLeadsPerModuleTrend(filters);
    expect(out).toEqual([
      { date: "2026-09-01", bySource: {} },
      { date: "2026-09-02", bySource: { Chatbot: 3, "Web form": 1 } },
      { date: "2026-09-03", bySource: {} },
    ]);
    expectScoped(lastSql(), "p1");
  });

  it("touch frequency maps grouped buckets, zero-filling the rest", async () => {
    queryRaw.mockResolvedValueOnce([
      { bucket: "1", n: BigInt(7) },
      { bucket: "5+", n: BigInt(2) },
    ]);
    const out = await getLeadsPerTouchFrequency(filters);
    expect(out).toEqual([
      { bucket: "1", count: 7 },
      { bucket: "2", count: 0 },
      { bucket: "3", count: 0 },
      { bucket: "4", count: 0 },
      { bucket: "5+", count: 2 },
    ]);
    expectScoped(lastSql(), "p1");
  });
});

describe("getPropertyTraffic", () => {
  it("shapes grouped landing-page days and query aggregates", async () => {
    lpGroupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by[0] === "url"
        ? []
        : [
            { date: new Date(), _sum: { sessions: 5 } },
            { date: new Date(Date.now() - 2 * 86400000), _sum: { sessions: 3 } },
          ],
    );
    sqGroupBy.mockResolvedValueOnce([
      { query: "a", _sum: { clicks: 1, impressions: 9 }, _avg: { ctr: 0.1, position: 3 } },
      { query: "b", _sum: { clicks: 4, impressions: 2 }, _avg: { ctr: 0.5, position: 1.5 } },
    ]);
    const out = await getPropertyTraffic("o", "p", { slug: "sunset", name: "Sunset" });
    expect(out.totalSessions28d).toBe(8);
    expect(out.sessionsSparkline[27]).toBe(5);
    expect(out.sessionsSparkline[25]).toBe(3);
    expect(out.topQueries.map((q) => q.query)).toEqual(["b", "a"]);
    expect(out.topQueries[0]).toMatchObject({ clicks: 4, impressions: 2, ctr: 0.5, position: 1.5 });
    expect(out.totalClicks28d).toBe(5);
  });
});
