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

  describe("/api/portal/seo/recommendations/[id]", () => {
    const route = "app/api/portal/seo/recommendations/[id]/route.ts";

    it("exports PATCH with tenant scoping", () => {
      const src = read(route);
      expect(src).toMatch(/export async function PATCH/);
      expect(src).toContain("requireScope");
      expect(src).toContain("tenantWhere");
    });

    it("enforces property-RBAC via allowedPropertyIds", () => {
      const src = read(route);
      expect(src).toContain("allowedPropertyIds");
    });

    it("requires reason for DISMISSED transition", () => {
      const src = read(route);
      expect(src).toContain("Provide a reason when dismissing");
    });

    it("busts the recommendation cache on status change", () => {
      const src = read(route);
      expect(src).toContain("invalidateRecommendationsCache");
    });

    it("writes completedAt + completedBy on COMPLETED", () => {
      const src = read(route);
      expect(src).toContain("completedAt");
      expect(src).toContain("completedBy");
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

  describe("/api/admin/content-drafts/bulk", () => {
    const route = "app/api/admin/content-drafts/bulk/route.ts";

    it("caps batch at 50 ids per call", () => {
      const src = read(route);
      expect(src).toMatch(/max\(50\)/);
    });

    it("requires notes when action is reject or request_changes", () => {
      const src = read(route);
      expect(src).toMatch(/Notes are required for reject and request_changes/i);
    });

    it("only operates on reviewable statuses", () => {
      const src = read(route);
      expect(src).toContain("PENDING_REVIEW");
      expect(src).toContain("CHANGES_REQUESTED");
    });

    it("closes linked recommendations on approve/ship", () => {
      const src = read(route);
      expect(src).toContain("seoActionRecommendation");
      expect(src).toContain("COMPLETED");
    });
  });

  describe("/api/portal/seo/recommendations/bulk", () => {
    const route = "app/api/portal/seo/recommendations/bulk/route.ts";

    it("validates tenant + property RBAC", () => {
      const src = read(route);
      expect(src).toContain("requireScope");
      expect(src).toContain("tenantWhere");
      expect(src).toContain("allowedPropertyIds");
    });

    it("requires reason for dismissed action", () => {
      const src = read(route);
      expect(src).toContain("Provide a reason when dismissing");
    });

    it("requires snoozeUntil for snoozed action and validates future", () => {
      const src = read(route);
      expect(src).toContain("Provide snoozeUntil");
      expect(src).toContain("future datetime");
    });

    it("busts the rec cache for each unique property touched", () => {
      const src = read(route);
      expect(src).toContain("invalidateRecommendationsCache");
    });

    it("writes audit events with bulk: true diff flag", () => {
      const src = read(route);
      expect(src).toContain("bulk: true");
    });
  });

  describe("/api/admin/seo-agent/refresh-all", () => {
    const route = "app/api/admin/seo-agent/refresh-all/route.ts";

    it("only runs when caller is admin", () => {
      const src = read(route);
      expect(src).toContain("requireAdmin");
    });

    it("filters to CLIENT orgType and LIVE properties", () => {
      const src = read(route);
      expect(src).toContain("OrgType.CLIENT");
      expect(src).toContain('launchStatus: "LIVE"');
    });

    it("upserts via the stable (orgId, propertyId, kind) key", () => {
      const src = read(route);
      expect(src).toContain("orgId_propertyId_kind");
    });

    it("expires OPEN recs the engine no longer emits", () => {
      const src = read(route);
      expect(src).toContain("EXPIRED");
    });

    it("writes a summary AuditEvent after the run", () => {
      const src = read(route);
      expect(src).toContain("auditEvent");
      expect(src).toContain("Admin force-refresh");
    });
  });

  describe("/api/cron/draft-expiry", () => {
    const route = "app/api/cron/draft-expiry/route.ts";

    it("verifies cron auth", () => {
      const src = read(route);
      expect(src).toContain("verifyCronAuth");
    });

    it("expires drafts older than the 14-day cutoff", () => {
      const src = read(route);
      expect(src).toMatch(/STALE_DAYS\s*=\s*14/);
    });

    it("revives snoozed recs whose snoozedUntil has passed", () => {
      const src = read(route);
      expect(src).toContain("snoozedUntil");
      expect(src).toMatch(/status:\s*"SNOOZED"/);
      expect(src).toMatch(/status:\s*"OPEN"/);
    });

    it("audits each expired row with stale reason", () => {
      const src = read(route);
      expect(src).toMatch(/stale > 14d/);
    });
  });

  describe("/api/portal/seo/recommendations/[id] (single PATCH)", () => {
    const route = "app/api/portal/seo/recommendations/[id]/route.ts";

    it("supports SNOOZED status with snoozeUntil validation", () => {
      const src = read(route);
      expect(src).toContain("SNOOZED");
      expect(src).toMatch(/must be in the future/);
    });

    it("OPEN transition clears terminal AND snooze columns", () => {
      const src = read(route);
      expect(src).toContain("snoozedUntil = null");
    });

    it("writes an AuditEvent with from/to diff", () => {
      const src = read(route);
      expect(src).toContain("auditEvent");
      expect(src).toContain("from: previousStatus");
    });
  });

  describe("/api/portal/seo/recommendations/export", () => {
    const route = "app/api/portal/seo/recommendations/export/route.ts";

    it("streams text/csv with attachment disposition", () => {
      const src = read(route);
      expect(src).toContain('"Content-Type": "text/csv; charset=utf-8"');
      expect(src).toContain("attachment;");
    });

    it("RFC 4180 quotes special characters", () => {
      const src = read(route);
      expect(src).toContain('replace(/"/g, \'""\')');
    });

    it("tenant + property-RBAC scoped", () => {
      const src = read(route);
      expect(src).toContain("requireScope");
      expect(src).toContain("allowedPropertyIds");
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
