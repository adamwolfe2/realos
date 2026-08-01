import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma BEFORE importing seo-sync — seo-sync reads/writes through it.
vi.mock("@/lib/db", () => {
  const make = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  });
  return {
    prisma: {
      seoIntegration: make(),
      seoSnapshot: make(),
      seoQuery: make(),
      seoLandingPage: make(),
    },
  };
});

vi.mock("@/lib/integrations/gsc", () => ({
  fetchGscDaily: vi.fn(),
  fetchGscQueriesByDate: vi.fn(),
}));

vi.mock("@/lib/integrations/ga4", () => ({
  fetchGa4OrganicDaily: vi.fn(),
  fetchGa4OrganicLandingPages: vi.fn(),
}));

import { runSeoSync } from "@/lib/integrations/seo-sync";
import { prisma } from "@/lib/db";
import { Prisma, SeoProvider } from "@prisma/client";

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}
import { fetchGscDaily, fetchGscQueriesByDate } from "@/lib/integrations/gsc";
import {
  fetchGa4OrganicDaily,
  fetchGa4OrganicLandingPages,
} from "@/lib/integrations/ga4";

// ---------------------------------------------------------------------------
// Wave 3 Phase 5 — property dimension on SEO metrics. Verifies runSeoSync
// keys every write by the producing integration's own propertyId, so two
// per-property integrations on the same org never overwrite each other's
// SeoSnapshot/SeoQuery/SeoLandingPage rows (the bug this phase fixes).
// ---------------------------------------------------------------------------

type AnyMock = ReturnType<typeof vi.fn>;

function baseIntegration(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "int-1",
    orgId: "org-1",
    propertyId: null as string | null,
    provider: SeoProvider.GSC,
    propertyIdentifier: "sc-domain:example.com",
    serviceAccountJsonEncrypted: "encrypted-json",
    lastSyncAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.seoIntegration.update as AnyMock).mockResolvedValue({});
  (prisma.seoSnapshot.findFirst as AnyMock).mockResolvedValue(null);
  (prisma.seoSnapshot.create as AnyMock).mockResolvedValue({});
  (prisma.seoSnapshot.update as AnyMock).mockResolvedValue({});
  (prisma.seoQuery.findFirst as AnyMock).mockResolvedValue(null);
  (prisma.seoQuery.create as AnyMock).mockResolvedValue({});
  (prisma.seoQuery.update as AnyMock).mockResolvedValue({});
  (prisma.seoLandingPage.findFirst as AnyMock).mockResolvedValue(null);
  (prisma.seoLandingPage.create as AnyMock).mockResolvedValue({});
  (prisma.seoLandingPage.update as AnyMock).mockResolvedValue({});
  (prisma.seoSnapshot.deleteMany as AnyMock).mockResolvedValue({ count: 0 });
  (prisma.seoQuery.deleteMany as AnyMock).mockResolvedValue({ count: 0 });
  (prisma.seoLandingPage.deleteMany as AnyMock).mockResolvedValue({ count: 0 });
  (fetchGscQueriesByDate as AnyMock).mockResolvedValue([]);
  (fetchGa4OrganicLandingPages as AnyMock).mockResolvedValue([]);
});

describe("runSeoSync — property-scoped writes (Wave 3 Phase 5)", () => {
  it("writes SeoSnapshot/SeoQuery keyed by the integration's own propertyId", async () => {
    const integration = baseIntegration({
      id: "int-prop1",
      propertyId: "prop-1",
    });
    (prisma.seoIntegration.findMany as AnyMock).mockResolvedValue([integration]);
    (fetchGscDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", impressions: 100, clicks: 10, ctr: 0.1, position: 3.2 },
    ]);
    (fetchGscQueriesByDate as AnyMock).mockResolvedValue([
      { date: "2026-07-15", query: "leasing near me", impressions: 20, clicks: 2, ctr: 0.1, position: 4 },
    ]);

    await runSeoSync("org-1", { fromDate: new Date("2026-07-15"), toDate: new Date("2026-07-15") });

    expect(prisma.seoSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1", propertyId: "prop-1" }),
      }),
    );
    expect(prisma.seoQuery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1", propertyId: "prop-1", query: "leasing near me" }),
      }),
    );
  });

  it("writes propertyId: null for a legacy org-wide integration", async () => {
    const integration = baseIntegration({ id: "int-orgwide", propertyId: null });
    (prisma.seoIntegration.findMany as AnyMock).mockResolvedValue([integration]);
    (fetchGscDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", impressions: 50, clicks: 5, ctr: 0.1, position: 5 },
    ]);

    await runSeoSync("org-1", { fromDate: new Date("2026-07-15"), toDate: new Date("2026-07-15") });

    expect(prisma.seoSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1", propertyId: null }),
      }),
    );
  });

  it("two integrations with different propertyIds never merge into the same SeoSnapshot row", async () => {
    const gscProp1 = baseIntegration({
      id: "int-gsc-1",
      propertyId: "prop-1",
      provider: SeoProvider.GSC,
    });
    const ga4Prop2 = baseIntegration({
      id: "int-ga4-2",
      propertyId: "prop-2",
      provider: SeoProvider.GA4,
      propertyIdentifier: "123456789",
    });
    (prisma.seoIntegration.findMany as AnyMock).mockResolvedValue([gscProp1, ga4Prop2]);

    // Same calendar date for both — this is exactly the collision scenario
    // the old org-keyed `dailyByDate` map merged incorrectly.
    (fetchGscDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", impressions: 100, clicks: 10, ctr: 0.1, position: 3 },
    ]);
    (fetchGa4OrganicDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", sessions: 40, users: 30 },
    ]);

    await runSeoSync("org-1", { fromDate: new Date("2026-07-15"), toDate: new Date("2026-07-15") });

    const creates = (prisma.seoSnapshot.create as AnyMock).mock.calls.map((c) => c[0].data);
    expect(creates).toHaveLength(2);

    const prop1Row = creates.find((d) => d.propertyId === "prop-1");
    const prop2Row = creates.find((d) => d.propertyId === "prop-2");
    expect(prop1Row).toBeDefined();
    expect(prop2Row).toBeDefined();

    // prop-1's row carries only the GSC fields it produced — GA4's sessions
    // from prop-2 must not have bled into it.
    expect(prop1Row.totalImpressions).toBe(100);
    expect(prop1Row.organicSessions).toBe(0);

    // prop-2's row carries only the GA4 fields it produced.
    expect(prop2Row.organicSessions).toBe(40);
    expect(prop2Row.totalImpressions).toBe(0);
  });

  it("updates an existing row by id instead of creating a duplicate when one is found", async () => {
    const integration = baseIntegration({ id: "int-1", propertyId: "prop-1" });
    (prisma.seoIntegration.findMany as AnyMock).mockResolvedValue([integration]);
    (prisma.seoSnapshot.findFirst as AnyMock).mockResolvedValue({ id: "existing-snap" });
    (fetchGscDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", impressions: 5, clicks: 1, ctr: 0.2, position: 2 },
    ]);

    await runSeoSync("org-1", { fromDate: new Date("2026-07-15"), toDate: new Date("2026-07-15") });

    expect(prisma.seoSnapshot.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "existing-snap" } }),
    );
    expect(prisma.seoSnapshot.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2026-08-01 review fixes: race-safe find-then-write (P2002 fallback) and
// the write-side double-counting supersede policy.
// ---------------------------------------------------------------------------

describe("runSeoSync — race-safe writes (P2002 fallback)", () => {
  it("falls back to updating the winner's row when create loses a concurrent-create race", async () => {
    const integration = baseIntegration({ id: "int-1", propertyId: "prop-1" });
    (prisma.seoIntegration.findMany as AnyMock).mockResolvedValue([integration]);
    (fetchGscDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", impressions: 100, clicks: 10, ctr: 0.1, position: 3 },
    ]);
    // First findFirst (pre-write check) sees nothing; create loses the race;
    // second findFirst (post-P2002 re-check) sees the concurrent winner.
    (prisma.seoSnapshot.findFirst as AnyMock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "winner-snap" });
    (prisma.seoSnapshot.create as AnyMock).mockRejectedValueOnce(p2002());

    const result = await runSeoSync("org-1", {
      fromDate: new Date("2026-07-15"),
      toDate: new Date("2026-07-15"),
    });

    expect(prisma.seoSnapshot.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "winner-snap" } }),
    );
    expect(result.stats.warnings).toHaveLength(0);
  });

  it("re-throws (and records a warning instead of aborting) a create failure that is NOT a P2002", async () => {
    const integration = baseIntegration({ id: "int-1", propertyId: "prop-1" });
    (prisma.seoIntegration.findMany as AnyMock).mockResolvedValue([integration]);
    (fetchGscDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", impressions: 100, clicks: 10, ctr: 0.1, position: 3 },
    ]);
    (prisma.seoSnapshot.create as AnyMock).mockRejectedValueOnce(
      new Error("connection reset"),
    );

    const result = await runSeoSync("org-1", {
      fromDate: new Date("2026-07-15"),
      toDate: new Date("2026-07-15"),
    });

    // The snapshot write loop catches per-date so one bad date doesn't
    // throw out of runSeoSync — it's recorded as a warning instead.
    expect(result.ok).toBe(false);
    expect(result.stats.warnings.some((w) => w.includes("connection reset"))).toBe(
      true,
    );
  });
});

describe("runSeoSync — double-counting write-side supersede policy", () => {
  it("deletes the org-wide NULL SeoSnapshot row for a date once a property-scoped row covers it", async () => {
    const integration = baseIntegration({ id: "int-1", propertyId: "prop-1" });
    (prisma.seoIntegration.findMany as AnyMock).mockResolvedValue([integration]);
    (fetchGscDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", impressions: 100, clicks: 10, ctr: 0.1, position: 3 },
    ]);

    await runSeoSync("org-1", {
      fromDate: new Date("2026-07-15"),
      toDate: new Date("2026-07-15"),
    });

    expect(prisma.seoSnapshot.deleteMany).toHaveBeenCalledWith({
      where: {
        orgId: "org-1",
        propertyId: null,
        date: { in: [new Date(Date.UTC(2026, 6, 15))] },
      },
    });
  });

  it("does NOT delete a NULL row for a date a NULL-scoped integration also wrote this same run", async () => {
    const propIntegration = baseIntegration({
      id: "int-prop",
      propertyId: "prop-1",
      provider: SeoProvider.GSC,
    });
    const orgWideIntegration = baseIntegration({
      id: "int-orgwide",
      propertyId: null,
      provider: SeoProvider.GA4,
      propertyIdentifier: "999",
    });
    (prisma.seoIntegration.findMany as AnyMock).mockResolvedValue([
      propIntegration,
      orgWideIntegration,
    ]);
    (fetchGscDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", impressions: 100, clicks: 10, ctr: 0.1, position: 3 },
    ]);
    (fetchGa4OrganicDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", sessions: 40, users: 30 },
    ]);

    await runSeoSync("org-1", {
      fromDate: new Date("2026-07-15"),
      toDate: new Date("2026-07-15"),
    });

    // Both a property-scoped row AND a NULL-scoped row were written for
    // 2026-07-15 this run (two different integrations) — the NULL row is
    // live data from the still-active NULL-scoped integration, not a
    // stale remainder, so it must survive.
    expect(prisma.seoSnapshot.deleteMany).not.toHaveBeenCalled();
  });

  it("never touches SeoQuery/SeoLandingPage cleanup for an org with no property-scoped integration", async () => {
    const integration = baseIntegration({ id: "int-orgwide", propertyId: null });
    (prisma.seoIntegration.findMany as AnyMock).mockResolvedValue([integration]);
    (fetchGscDaily as AnyMock).mockResolvedValue([
      { date: "2026-07-15", impressions: 50, clicks: 5, ctr: 0.1, position: 5 },
    ]);
    (fetchGscQueriesByDate as AnyMock).mockResolvedValue([
      { date: "2026-07-15", query: "leasing near me", impressions: 20, clicks: 2, ctr: 0.1, position: 4 },
    ]);

    await runSeoSync("org-1", {
      fromDate: new Date("2026-07-15"),
      toDate: new Date("2026-07-15"),
    });

    expect(prisma.seoSnapshot.deleteMany).not.toHaveBeenCalled();
    expect(prisma.seoQuery.deleteMany).not.toHaveBeenCalled();
  });
});
