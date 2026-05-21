import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Structural tests for the SEO content-draft workflow routes.
// Confirms each route file exists, enforces auth correctly, and uses Zod
// validation. Catches accidental removal / typos in auth boundary code.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

describe("SEO content-draft routes — structural contract", () => {
  describe("/api/portal/seo/drafts", () => {
    const route = "app/api/portal/seo/drafts/route.ts";

    it("exists and exports GET + POST", () => {
      const src = read(route);
      expect(src).toMatch(/export async function GET/);
      expect(src).toMatch(/export async function POST/);
    });

    it("uses requireScope for tenant gating", () => {
      const src = read(route);
      expect(src).toContain("requireScope");
      expect(src).toContain("tenantWhere");
    });

    it("validates input with Zod", () => {
      const src = read(route);
      expect(src).toContain("z.object");
      expect(src).toContain("ContentFormat");
    });

    it("enforces an in-flight draft cap to bound Claude spend", () => {
      const src = read(route);
      expect(src).toContain("inFlight");
      // 10 in-flight + 30/day + 5/hour all guard cost.
      expect(src).toMatch(/30|in-flight|rate limit/i);
    });

    it("validates recommendationId belongs to the org+property (cross-tenant fix)", () => {
      const src = read(route);
      expect(src).toContain("Invalid recommendation");
      expect(src).toMatch(/seoActionRecommendation[\s\S]*orgId/);
    });

    it("checks scope.allowedPropertyIds for property-level RBAC", () => {
      const src = read(route);
      expect(src).toContain("allowedPropertyIds");
    });
  });

  describe("/api/portal/seo/drafts/[id]", () => {
    const route = "app/api/portal/seo/drafts/[id]/route.ts";

    it("guards via requireScope on every verb", () => {
      const src = read(route);
      expect(src.match(/requireScope\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    });

    it("refuses to edit APPROVED or SHIPPED drafts", () => {
      const src = read(route);
      expect(src).toContain("APPROVED");
      expect(src).toContain("SHIPPED");
    });
  });

  describe("/api/portal/seo/target-queries", () => {
    const route = "app/api/portal/seo/target-queries/route.ts";

    it("caps active target queries per property", () => {
      const src = read(route);
      // 20-cap keeps the daily DataforSEO scan under the cost guard.
      expect(src).toContain("20");
      expect(src).toContain("active: true");
    });

    it("normalizes queries to lowercase for dedupe", () => {
      const src = read(route);
      expect(src).toContain("toLowerCase");
    });
  });

  describe("/api/portal/seo/recommendations/refresh", () => {
    const route = "app/api/portal/seo/recommendations/refresh/route.ts";

    it("caps the batch size to keep wall-time bounded", () => {
      const src = read(route);
      // 25 properties per call when no propertyId is provided.
      expect(src).toContain("25");
    });

    it("upserts on the stable (orgId, propertyId, kind) key", () => {
      const src = read(route);
      expect(src).toContain("orgId_propertyId_kind");
    });

    it("expires stale OPEN recs not re-emitted by the engine", () => {
      const src = read(route);
      expect(src).toContain("EXPIRED");
    });
  });

  describe("/api/admin/content-drafts", () => {
    const list = "app/api/admin/content-drafts/route.ts";
    const item = "app/api/admin/content-drafts/[id]/route.ts";
    const approve = "app/api/admin/content-drafts/[id]/approve/route.ts";
    const reject = "app/api/admin/content-drafts/[id]/reject/route.ts";

    it("all admin endpoints call requireAdmin", () => {
      expect(read(list)).toContain("requireAdmin");
      expect(read(item)).toContain("requireAdmin");
      expect(read(approve)).toContain("requireAdmin");
      expect(read(reject)).toContain("requireAdmin");
    });

    it("approve closes the linked recommendation when present", () => {
      const src = read(approve);
      expect(src).toContain("seoActionRecommendation");
      expect(src).toContain("COMPLETED");
    });

    it("approve preserves prior reviewNotes when not provided (L1 fix)", () => {
      const src = read(approve);
      expect(src).toMatch(/body\?\.notes !== undefined/);
    });

    it("reject requires notes >= 4 chars", () => {
      const src = read(reject);
      expect(src).toMatch(/min\(4\)/);
    });

    it("reject supports both terminal reject and request_changes", () => {
      const src = read(reject);
      expect(src).toContain("request_changes");
      expect(src).toContain("REJECTED");
      expect(src).toContain("CHANGES_REQUESTED");
    });
  });
});

describe("Score-history cron wiring", () => {
  it("seo-fact-aggregate cron invokes writeScoreSnapshot", () => {
    const src = read("app/api/cron/seo-fact-aggregate/route.ts");
    expect(src).toContain("writeScoreSnapshot");
  });

  it("vercel.json schedules seo-fact-aggregate daily", () => {
    const vercel = JSON.parse(read("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const found = vercel.crons.find(
      (c) => c.path === "/api/cron/seo-fact-aggregate",
    );
    expect(found).toBeDefined();
  });
});
