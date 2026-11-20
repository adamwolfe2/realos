import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Regression (multi-property): runAeoScan walked an org's properties in a
// fixed updatedAt order and the cron deadline cuts a scan mid-org, so with
// two ACTIVE properties A and B the same property was scanned every run and
// the other was never reached. The stalest property must go first.

const base = {
  orgId: "o1",
  websiteUrl: null,
  city: "Berkeley",
  state: "CA",
  propertyType: "RESIDENTIAL",
  residentialSubtype: "STUDENT_HOUSING",
  commercialSubtype: null,
  addressLine1: null,
};

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      // updatedAt desc: A (recently edited) comes back first.
      findMany: vi.fn(async () => [
        { ...base, id: "A", name: "Alpha House" },
        { ...base, id: "B", name: "Beta House" },
      ]),
    },
    aeoCitationCheck: {
      // A was scanned yesterday; B has never been scanned.
      groupBy: vi.fn(async () => [
        { propertyId: "A", _max: { queryRunAt: new Date(Date.now() - 86_400_000) } },
      ]),
    },
    aeoCustomPrompt: { findMany: vi.fn(async () => []) },
  },
}));

const { runAeoScan } = await import("@/lib/aeo/orchestrate");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("runAeoScan property order (two-property org)", () => {
  it("scans the never-scanned property before the recently scanned one", async () => {
    const seen: string[] = [];
    const engine = {
      engine: "CLAUDE",
      runPrompt: vi.fn(async (_p: string, ctx: { propertyId: string }) => {
        seen.push(ctx.propertyId);
        vi.advanceTimersByTime(60_000);
        return { skipped: true };
      }),
    } as never;
    // Deadline allows exactly one prompt, as when the cron runs out of time.
    await runAeoScan({ orgId: "o1", engines: [engine], deadline: Date.now() + 30_000 });
    expect(seen).toEqual(["B"]);
  });

  it("limits the property query to propertyIds (a restricted user's grant)", async () => {
    const { prisma } = await import("@/lib/db");
    const findMany = prisma.property.findMany as unknown as ReturnType<typeof vi.fn>;
    findMany.mockClear();
    await runAeoScan({ orgId: "o1", engines: [], propertyIds: ["A"] });
    const where = (findMany.mock.calls[0] as unknown as [{ where: { AND: unknown[] } }])[0].where;
    expect(where.AND).toContainEqual({ id: { in: ["A"] } });
  });
});
