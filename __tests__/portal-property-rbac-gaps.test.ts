import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Regression: property-level RBAC (`scope.allowedPropertyIds`) was enforced on
// most portal surfaces but silently skipped on seven of them. One root cause,
// seven symptoms:
//
//   PORTAL-PROPERTIES-D001  /portal/properties/compare  (?ids= + picker)
//   PORTAL-PROPERTIES-D002  /portal/properties/curate   (queue + bulk select)
//   PORTAL-LEADS-D001/2/3   sendLeadEmail / sendLeadSms / sendManualReviewRequest
//   PORTAL-LEADS-D004       /portal/visitors live-chats panel
//   PORTAL-LEADS-D005       hashed-email visitor CSV export (inverse direction —
//                           org-level rows must stay visible)
//
// Both directions are asserted everywhere it is testable:
//   (a) restricted operator (allowedPropertyIds = [a]) is gated
//   (b) unrestricted operator (allowedPropertyIds = null) is NOT constrained.
// (b) is the one that protects every existing customer: a gate that treats
// `null` as "no properties" would lock every normal operator out of their own
// portfolio.
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockRequireScope = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

class ForbiddenErrorStub extends Error {
  status = 403;
}

// Real property-filter (the thing under test) — only the scope module is mocked.
vi.mock("@/lib/tenancy/scope", () => ({
  requireScope: () => mockRequireScope(),
  requireWritableWorkspace: () => mockRequireScope(),
  tenantWhere: (s: { orgId: string }) => ({ orgId: s.orgId }),
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (
    scope: Record<string, unknown>,
    rest: Record<string, unknown>,
  ) => ({ ...scope, ...rest }),
}));

// Outbound transports stubbed — these tests never get past the lead lookup,
// which is exactly the boundary under test.
vi.mock("@/lib/email/shared", () => ({
  buildBaseHtml: () => "<p></p>",
  getResend: () => null,
  isValidEmail: () => true,
  FROM_EMAIL: "noreply@leasestack.test",
  BRAND_EMAIL: "hello@leasestack.test",
}));
vi.mock("@/lib/sms/twilio", () => ({
  isSmsConfigured: () => true,
  sendSms: async () => ({ ok: false as const, error: "stubbed" }),
}));
vi.mock("@/lib/email/review-request", () => ({
  sendReviewRequestEmail: async () => ({ ok: false as const, error: "stubbed" }),
}));

const { sendLeadEmail } = await import("@/lib/actions/lead-email");
const { sendLeadSms } = await import("@/lib/actions/lead-sms");
const { sendManualReviewRequest } = await import(
  "@/lib/actions/lead-review-request"
);

function scope(allowedPropertyIds: string[] | null) {
  return {
    userId: "u1",
    clerkUserId: "clerk_u1",
    orgId: "org-1",
    actualOrgId: "org-1",
    role: "LEASING_AGENT",
    email: "agent@client.test",
    allowedPropertyIds,
  };
}

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireScope.mockReset();
});

// ---------------------------------------------------------------------------
// PORTAL-LEADS-D001/D002/D003 — outbound lead actions (behavioral)
// ---------------------------------------------------------------------------

const LEAD_ACTIONS: Array<{
  name: string;
  run: () => Promise<{ ok: boolean }>;
}> = [
  {
    name: "sendLeadEmail",
    run: () =>
      sendLeadEmail({
        leadId: "lead-on-prop-c",
        subject: "Hello",
        body: "Body text",
      }),
  },
  { name: "sendLeadSms", run: () => sendLeadSms({ leadId: "lead-on-prop-c", body: "Hi" }) },
  {
    name: "sendManualReviewRequest",
    run: () => sendManualReviewRequest({ leadId: "lead-on-prop-c" }),
  },
];

describe.each(LEAD_ACTIONS)(
  "$name — property RBAC gate on the lead lookup",
  ({ run }) => {
    it("restricted scope constrains the lookup to the granted properties", async () => {
      mockRequireScope.mockResolvedValue(scope(["prop-a", "prop-b"]));
      mockPrisma.lead.findFirst.mockResolvedValue(null); // out of scope

      const res = await run();

      const where = mockPrisma.lead.findFirst.mock.calls[0][0].where;
      expect(where.orgId).toBe("org-1");
      expect(where.propertyId).toEqual({ in: ["prop-a", "prop-b"] });
      expect(res.ok).toBe(false);
      // Nothing was sent and no state was written for a lead the caller
      // has no property access to.
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("single-property scope collapses to a direct id match", async () => {
      mockRequireScope.mockResolvedValue(scope(["prop-a"]));
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await run();

      const where = mockPrisma.lead.findFirst.mock.calls[0][0].where;
      expect(where.propertyId).toBe("prop-a");
    });

    it("unrestricted scope adds NO property constraint (existing operators unaffected)", async () => {
      mockRequireScope.mockResolvedValue(scope(null));
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      await run();

      const where = mockPrisma.lead.findFirst.mock.calls[0][0].where;
      expect(where.orgId).toBe("org-1");
      expect(where.propertyId).toBeUndefined();
      expect(Object.keys(where).sort()).toEqual(["id", "orgId"]);
    });
  },
);

// ---------------------------------------------------------------------------
// Page-level gates — structural. These surfaces are server components with
// heavy import graphs; the repo's established pattern (see
// __tests__/seo-content-draft-routes.test.ts) is to assert the gate call is
// present in the source so it can't be silently dropped later.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

describe("PORTAL-PROPERTIES-D001 — /portal/properties/compare", () => {
  const src = read("app/portal/properties/compare/page.tsx");

  it("intersects the ?ids= selection with the access gate", () => {
    expect(src).toContain("effectivePropertyIds(scope,");
  });

  it("filters the picker to properties the caller can see", () => {
    expect(src).toMatch(/prisma\.property\.findMany\(\{[\s\S]{0,200}propertyWhereFragment\(scope, null, "id"\)/);
  });

  it("does not query metrics off the raw URL ids", () => {
    // The aggregates below key off `requestedIds`; that name must be the
    // gated list, never the raw parse result.
    expect(src).toMatch(/const requestedIds = effectivePropertyIds\(/);
  });
});

describe("PORTAL-PROPERTIES-D002 — /portal/properties/curate", () => {
  const src = read("app/portal/properties/curate/page.tsx");

  it("applies a property access gate alongside tenantWhere", () => {
    expect(src).toContain('propertyWhereFragment(scope, null, "id")');
  });

  it("gates the queue list AND every lifecycle count", () => {
    // 1 findMany + 3 counts all spread the same gate.
    const uses = src.match(/\.\.\.accessGate/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(4);
  });
});

describe("PORTAL-LEADS-D004 — /portal/visitors live-chats panel", () => {
  const src = read("app/portal/visitors/page.tsx");

  it("scopes the live chatbotConversation query by the page's property clause", () => {
    expect(src).toMatch(
      /prisma\.chatbotConversation[\s\S]{0,120}where: \{[\s\S]{0,80}\.\.\.propertyClause,[\s\S]{0,120}lastMessageAt: \{ gte: liveSince \}/,
    );
  });
});

describe("PORTAL-LEADS-D005 — hashed-email visitor CSV export", () => {
  const src = read("app/api/tenant/visitors/export/route.ts");

  it("uses the org-level-inclusive fragment so pixel visitors survive the gate", () => {
    expect(src).toContain("propertyOrOrgLevelWhereFragment(scope, propertyIds)");
  });

  it("no longer uses the bare fragment that dropped propertyId=null rows", () => {
    expect(src).not.toMatch(/[^a-zA-Z]propertyWhereFragment\(/);
  });
});

// ---------------------------------------------------------------------------
// D005, both directions, on the helper the export now calls. Org-level rows
// (propertyId = null) must stay visible to a RESTRICTED operator, while an
// out-of-bounds selection must still deny.
// ---------------------------------------------------------------------------

const { propertyOrOrgLevelWhereFragment } = await import(
  "@/lib/tenancy/property-filter"
);

describe("propertyOrOrgLevelWhereFragment — visitor export semantics", () => {
  it("restricted operator keeps org-level (propertyId=null) visitors", () => {
    expect(
      propertyOrOrgLevelWhereFragment({ allowedPropertyIds: ["prop-a"] }, null),
    ).toEqual({ OR: [{ propertyId: "prop-a" }, { propertyId: null }] });
  });

  it("unrestricted operator with no selection stays completely unfiltered", () => {
    expect(
      propertyOrOrgLevelWhereFragment({ allowedPropertyIds: null }, null),
    ).toEqual({});
  });

  it("restricted operator selecting a forbidden property still sees nothing", () => {
    expect(
      propertyOrOrgLevelWhereFragment({ allowedPropertyIds: ["prop-a"] }, [
        "prop-b",
      ]),
    ).toEqual({ propertyId: "__no_property_access__" });
  });
});
