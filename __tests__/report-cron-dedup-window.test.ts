import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// periodStart = runNow - 7d to the millisecond. The catch-up run 2h later
// (vercel.json "0 7,9 * * 1") must find the 07:00 draft and not re-send.
type Row = { orgId: string; kind: string; periodStart: Date; propertyId?: string | null; generatedBy?: string | null };
const m = vi.hoisted(() => ({ rows: [] as Row[], send: vi.fn() }));

vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: async (_n: string, fn: () => Promise<{ result: unknown }>) => (await fn()).result,
}));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/reports/token", () => ({ generateShareToken: () => "tok" }));
vi.mock("@/lib/notifications/create", () => ({ notifyReportDraftReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email/send-report", () => ({ sendReportEmail: m.send }));
vi.mock("@/lib/reports/generate", async () => {
  const resolvePeriod = (_k: string, now: Date) => ({
    periodStart: new Date(now.getTime() - 7 * 86_400_000),
    periodEnd: now,
  });
  return {
    resolvePeriod,
    generateReportSnapshot: async (_o: string, k: string, { now }: { now: Date }) => {
      const p = resolvePeriod(k, now);
      return { periodStart: p.periodStart.toISOString(), periodEnd: p.periodEnd.toISOString() };
    },
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findMany: async () => [
        { id: "o1", name: "Org", logoUrl: null, reportCadence: "weekly", reportAutoSend: true, reportRecipients: ["a@example.com"] },
      ],
      findFirst: async () => ({ id: "agency" }),
    },
    clientReport: {
      findMany: async ({ where }: { where: { kind: string; periodStart: { gte: Date; lte: Date }; propertyId?: null; generatedBy?: null } }) =>
        m.rows.filter(
          (r) =>
            r.kind === where.kind &&
            r.periodStart >= where.periodStart.gte &&
            r.periodStart <= where.periodStart.lte &&
            (!("propertyId" in where) || (r.propertyId ?? null) === where.propertyId) &&
            (!("generatedBy" in where) || (r.generatedBy ?? null) === where.generatedBy),
        ),
      create: async ({ data }: { data: Row }) => {
        m.rows.push(data);
        return { id: `r${m.rows.length}`, shareToken: "tok" };
      },
      update: async () => ({}),
    },
  },
}));

const { GET } = await import("@/app/api/cron/weekly-report/route");

describe("weekly-report catch-up run", () => {
  beforeEach(() => {
    m.rows.length = 0;
    m.send.mockReset().mockResolvedValue({ ok: true });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("drafts and sends once across the 07:00 and 09:00 runs", async () => {
    vi.setSystemTime(new Date("2026-10-19T07:00:03Z"));
    await GET(new Request("https://x/api/cron/weekly-report") as never);
    vi.setSystemTime(new Date("2026-10-19T09:00:05Z"));
    await GET(new Request("https://x/api/cron/weekly-report") as never);
    expect(m.rows).toHaveLength(1);
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("a manual or property-scoped report in the window does not suppress the cron draft", async () => {
    vi.setSystemTime(new Date("2026-10-19T07:00:00Z"));
    const ps = new Date(Date.now() - 7 * 86_400_000 - 3_600_000);
    m.rows.push(
      { orgId: "o1", kind: "weekly", periodStart: ps, propertyId: "p1" },
      { orgId: "o1", kind: "weekly", periodStart: ps, generatedBy: "user_1" },
    );
    await GET(new Request("https://x/api/cron/weekly-report") as never);
    expect(m.rows).toHaveLength(3);
    expect(m.send).toHaveBeenCalledTimes(1);
  });

  it("still drafts next week's report", async () => {
    vi.setSystemTime(new Date("2026-10-19T07:00:00Z"));
    await GET(new Request("https://x/api/cron/weekly-report") as never);
    vi.setSystemTime(new Date("2026-10-26T07:00:00Z"));
    await GET(new Request("https://x/api/cron/weekly-report") as never);
    expect(m.rows).toHaveLength(2);
  });
});
