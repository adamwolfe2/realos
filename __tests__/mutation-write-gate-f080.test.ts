import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// F-080: content draft PATCH/DELETE and insight mutations must go through
// requireWritableWorkspace (write seat + trial gate); GET stays requireScope.

const mocks = vi.hoisted(() => ({
  requireScope: vi.fn(),
  requireWritableWorkspace: vi.fn(),
  draftFindFirst: vi.fn(),
  draftDelete: vi.fn(),
  insightFindFirst: vi.fn(),
  insightUpdate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenancy/scope", () => {
  class ForbiddenError extends Error {
    status = 403;
  }
  return {
    requireScope: () => mocks.requireScope(),
    requireWritableWorkspace: () => mocks.requireWritableWorkspace(),
    tenantWhere: (s: { orgId: string }) => ({ orgId: s.orgId }),
    ForbiddenError,
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    contentDraft: {
      findFirst: (...a: unknown[]) => mocks.draftFindFirst(...a),
      delete: (...a: unknown[]) => mocks.draftDelete(...a),
    },
    insight: {
      findFirst: (...a: unknown[]) => mocks.insightFindFirst(...a),
      update: (...a: unknown[]) => mocks.insightUpdate(...a),
    },
  },
}));

const scopeMod = await import("@/lib/tenancy/scope");
const route = await import("@/app/api/portal/content/[id]/route");
const { dismissInsight } = await import("@/app/portal/insights/actions");

const viewer = { orgId: "org-1", userId: "u1", allowedPropertyIds: null };
const ctx = { params: Promise.resolve({ id: "d1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireScope.mockResolvedValue(viewer);
  mocks.requireWritableWorkspace.mockRejectedValue(
    new scopeMod.ForbiddenError("Your role is read-only in this workspace."),
  );
  mocks.draftFindFirst.mockResolvedValue({ id: "d1", orgId: "org-1", propertyId: null });
  mocks.insightFindFirst.mockResolvedValue({ id: "i1" });
});

describe("F-080 write gates", () => {
  it("content GET still works on requireScope", async () => {
    const res = await route.GET(new NextRequest("http://localhost/x"), ctx);
    expect(res.status).toBe(200);
  });

  it("content DELETE is blocked by the write gate", async () => {
    const res = await route.DELETE(
      new NextRequest("http://localhost/x", { method: "DELETE" }),
      ctx,
    );
    expect(res.status).toBe(403);
    expect(mocks.draftDelete).not.toHaveBeenCalled();
  });

  it("content PATCH is blocked by the write gate", async () => {
    const res = await route.PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief: "x" }),
      }),
      ctx,
    );
    expect(res.status).toBe(403);
  });

  it("dismissInsight is blocked by the write gate", async () => {
    const res = await dismissInsight("i1");
    expect(res).toHaveProperty("error");
    expect(mocks.insightUpdate).not.toHaveBeenCalled();
  });
});
