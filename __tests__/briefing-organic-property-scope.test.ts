import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma BEFORE importing briefing/queries.
vi.mock("@/lib/db", () => {
  const countMock = () => ({ count: vi.fn(async () => 0) });
  const aggMock = () => ({ aggregate: vi.fn(async () => ({ _sum: { organicSessions: 0, spendCents: 0 } })) });
  return {
    prisma: {
      lead: countMock(),
      tour: countMock(),
      application: countMock(),
      chatbotConversation: countMock(),
      adMetricDaily: aggMock(),
      seoSnapshot: { findMany: vi.fn(async () => []) },
    },
  };
});

import { getBriefingMetrics } from "@/lib/briefing/queries";
import { prisma } from "@/lib/db";

type AnyMock = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Wave 3 Phase 5 — getBriefingMetrics' organic-sessions tile now has a real
// propertyId to filter on (SeoSnapshot gained the column this phase). When
// the caller passes propertyIds, the query must scope to that property's
// own rows (NOT the org-wide NULL rows, which are a separate portfolio
// bucket). When no propertyIds are passed, it stays org-wide.
//
// 2026-08-01: the org-wide read now goes through fetchDedupedSeoSnapshots
// (lib/seo/snapshot-supersede.ts, findMany + JS sum) instead of a raw
// prisma.seoSnapshot.aggregate, so it can apply the read-side supersede
// dedupe and never double-count a legacy NULL row against a property row
// for the same date. See seo-snapshot-supersede.test.ts for the dedupe
// behavior itself.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBriefingMetrics — organic sessions property scope", () => {
  it("filters SeoSnapshot by propertyId when propertyIds is provided", async () => {
    await getBriefingMetrics("org-1", { propertyIds: ["prop-1"] });

    const calls = (prisma.seoSnapshot.findMany as AnyMock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [args] of calls) {
      expect(args.where.orgId).toBe("org-1");
      expect(args.where.propertyId).toBe("prop-1");
    }
  });

  it("filters SeoSnapshot by propertyId: { in } for multiple properties", async () => {
    await getBriefingMetrics("org-1", { propertyIds: ["prop-1", "prop-2"] });

    const calls = (prisma.seoSnapshot.findMany as AnyMock).mock.calls;
    for (const [args] of calls) {
      expect(args.where.propertyId).toEqual({ in: ["prop-1", "prop-2"] });
    }
  });

  it("does not filter by propertyId when no propertyIds are passed (org-wide, includes NULL rows)", async () => {
    await getBriefingMetrics("org-1", {});

    const calls = (prisma.seoSnapshot.findMany as AnyMock).mock.calls;
    for (const [args] of calls) {
      expect(args.where.orgId).toBe("org-1");
      expect(args.where.propertyId).toBeUndefined();
    }
  });
});
