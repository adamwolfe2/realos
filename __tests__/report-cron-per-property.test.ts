import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Scheduled report drafts per property (2026-11). An org with 2+ ACTIVE
// properties gets the org-wide draft AND one draft per ACTIVE property; an
// org with exactly one ACTIVE property keeps a single org-wide draft.
// Dedup is per (org, property): a re-run never duplicates and one
// property's draft never suppresses another's.
// ---------------------------------------------------------------------------

type Row = {
  orgId: string;
  kind: string;
  periodStart: Date;
  propertyId?: string | null;
  generatedBy?: string | null;
  generatedAt?: Date;
};
type Prop = { id: string; orgId: string; lifecycle: string };

const m = vi.hoisted(() => ({
  rows: [] as Row[],
  props: [] as Prop[],
  orgs: [] as Array<Record<string, unknown>>,
  send: vi.fn(),
  notify: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: async (_n: string, fn: () => Promise<{ result: unknown }>) => (await fn()).result,
}));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/reports/token", () => ({ generateShareToken: () => "tok" }));
vi.mock("@/lib/notifications/create", () => ({ notifyReportDraftReady: m.notify }));
vi.mock("@/lib/email/send-report", () => ({ sendReportEmail: m.send }));
vi.mock("@/lib/reports/generate", async () => {
  const resolvePeriod = (k: string, now: Date) => ({
    periodStart: new Date(now.getTime() - (k === "weekly" ? 7 : 28) * 86_400_000),
    periodEnd: now,
  });
  return {
    resolvePeriod,
    generateReportSnapshot: async (orgId: string, k: string, opts: { now: Date; propertyId?: string }) => {
      m.generate(orgId, k, opts.propertyId ?? null);
      const p = resolvePeriod(k, opts.now);
      return { periodStart: p.periodStart.toISOString(), periodEnd: p.periodEnd.toISOString() };
    },
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findMany: async () => m.orgs,
      findFirst: async () => ({ id: "agency" }),
    },
    property: {
      findMany: async ({ where }: { where: { orgId: { in: string[] }; lifecycle: string } }) =>
        m.props
          .filter((p) => where.orgId.in.includes(p.orgId) && p.lifecycle === where.lifecycle)
          .map((p) => ({ id: p.id, orgId: p.orgId })),
    },
    clientReport: {
      findMany: async ({ where }: { where: { kind: string; periodStart: { gte: Date; lte: Date } } }) =>
        m.rows.filter(
          (r) =>
            r.kind === where.kind &&
            (r.generatedBy ?? null) === null &&
            r.periodStart >= where.periodStart.gte &&
            r.periodStart <= where.periodStart.lte,
        ).map((r) => ({ orgId: r.orgId, propertyId: r.propertyId ?? null })),
      groupBy: async ({ where }: { where: { kind: string } }) => {
        const latest = new Map<string, Row>();
        for (const r of m.rows) {
          if (r.kind !== where.kind || r.generatedBy) continue;
          const k = r.propertyId ? `${r.orgId}:${r.propertyId}` : r.orgId;
          const prev = latest.get(k);
          if (!prev || (r.generatedAt?.getTime() ?? 0) > (prev.generatedAt?.getTime() ?? 0)) latest.set(k, r);
        }
        return [...latest.values()].map((r) => ({
          orgId: r.orgId,
          propertyId: r.propertyId ?? null,
          _max: { generatedAt: r.generatedAt ?? null },
        }));
      },
      create: async ({ data }: { data: Row }) => {
        m.rows.push({ ...data, generatedAt: new Date() });
        return { id: `r${m.rows.length}`, shareToken: "tok" };
      },
      update: async () => ({}),
    },
  },
}));

const weekly = await import("@/app/api/cron/weekly-report/route");
const monthly = await import("@/app/api/cron/monthly-report/route");

const ORG = (id: string, cadence: string) => ({
  id,
  name: id,
  logoUrl: null,
  primaryContactEmail: null,
  primaryContactName: null,
  reportCadence: cadence,
  reportAutoSend: true,
  reportRecipients: ["ops@example.com"],
});

const run = (route: { GET: (r: never) => Promise<unknown> }) =>
  route.GET(new Request("https://x/api/cron") as never) as Promise<Response>;

beforeEach(() => {
  m.rows.length = 0;
  m.props.length = 0;
  m.generate.mockReset();
  m.send.mockReset().mockResolvedValue({ ok: true });
  m.notify.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T07:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe.each([
  ["weekly", weekly],
  ["monthly", monthly],
] as const)("%s-report cron per property", (kind, route) => {
  const cadence = kind;

  it("two ACTIVE properties: org-wide draft + one draft per property, nothing for non-ACTIVE", async () => {
    m.orgs = [ORG("o1", cadence)];
    m.props.push(
      { id: "pA", orgId: "o1", lifecycle: "ACTIVE" },
      { id: "pB", orgId: "o1", lifecycle: "ACTIVE" },
      { id: "pX", orgId: "o1", lifecycle: "EXCLUDED" },
    );
    await run(route);
    expect(m.rows.map((r) => r.propertyId ?? null).sort()).toEqual([null, "pA", "pB"].sort());
    expect(m.generate.mock.calls.map((c) => c[2]).sort()).toEqual([null, "pA", "pB"].sort());
    // Auto-send (org-level recipients) still sends only the org-wide draft.
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("three drafts in one run ping the bell once (org-wide draft only)", async () => {
    m.orgs = [{ ...ORG("o1", cadence), reportAutoSend: false }];
    m.props.push(
      { id: "pA", orgId: "o1", lifecycle: "ACTIVE" },
      { id: "pB", orgId: "o1", lifecycle: "ACTIVE" },
    );
    await run(route);
    expect(m.rows).toHaveLength(3);
    expect(m.notify).toHaveBeenCalledTimes(1);
  });

  it("one ACTIVE property + 100 EXCLUDED: unchanged single org-wide draft", async () => {
    m.orgs = [ORG("o1", cadence)];
    m.props.push({ id: "pA", orgId: "o1", lifecycle: "ACTIVE" });
    for (let i = 0; i < 100; i++) m.props.push({ id: `x${i}`, orgId: "o1", lifecycle: "EXCLUDED" });
    await run(route);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].propertyId ?? null).toBeNull();
    expect(m.generate.mock.calls.map((c) => c[2])).toEqual([null]);
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("a re-run never duplicates any unit", async () => {
    m.orgs = [ORG("o1", cadence)];
    m.props.push(
      { id: "pA", orgId: "o1", lifecycle: "ACTIVE" },
      { id: "pB", orgId: "o1", lifecycle: "ACTIVE" },
    );
    await run(route);
    vi.setSystemTime(new Date("2026-11-02T09:00:05Z"));
    await run(route);
    expect(m.rows).toHaveLength(3);
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("A's existing draft does not suppress B's or the org-wide one", async () => {
    m.orgs = [ORG("o1", cadence)];
    m.props.push(
      { id: "pA", orgId: "o1", lifecycle: "ACTIVE" },
      { id: "pB", orgId: "o1", lifecycle: "ACTIVE" },
    );
    const ps = new Date(Date.now() - (kind === "weekly" ? 7 : 28) * 86_400_000 - 3_600_000);
    m.rows.push({ orgId: "o1", kind, periodStart: ps, propertyId: "pA", generatedAt: new Date() });
    await run(route);
    expect(m.rows.map((r) => r.propertyId ?? null).sort()).toEqual([null, "pA", "pB"].sort());
  });

  it("time-budget overrun defers the remaining units by name (never silent), stalest first", async () => {
    m.orgs = [ORG("o1", cadence)];
    m.props.push(
      { id: "pA", orgId: "o1", lifecycle: "ACTIVE" },
      { id: "pB", orgId: "o1", lifecycle: "ACTIVE" },
    );
    // Earlier periods: org-wide and A drafted recently, B never drafted.
    const old = new Date("2026-09-01T00:00:00Z");
    m.rows.push(
      { orgId: "o1", kind, periodStart: old, propertyId: null, generatedAt: new Date("2026-10-26T07:00:00Z") },
      { orgId: "o1", kind, periodStart: old, propertyId: "pA", generatedAt: new Date("2026-10-26T07:00:00Z") },
    );
    // Each generation eats 150s of the 200s budget: only one unit fits.
    m.generate.mockImplementation(() => vi.advanceTimersByTime(150_000 + 60_000));
    const res = await run(route);
    const json = await res.json();
    // B (never drafted) was the stalest, so it went first.
    expect(m.generate.mock.calls.map((c) => c[2])).toEqual(["pB"]);
    expect(json.deferred.sort()).toEqual(["o1", "o1:pA"].sort());
  });
});
