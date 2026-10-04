import { beforeEach, describe, expect, it, vi } from "vitest";

// Review-A MEDIUM-1: org-level white-label settings go through
// requireWorkspaceAdmin, so a non-admin seat is stopped before any DB read.

const mocks = vi.hoisted(() => ({
  requireWorkspaceAdmin: vi.fn(),
  orgFindUnique: vi.fn(),
  orgUpdate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenancy/scope", () => {
  class ForbiddenError extends Error {
    status = 403;
  }
  return {
    requireWorkspaceAdmin: () => mocks.requireWorkspaceAdmin(),
    auditPayload: (_s: unknown, r: unknown) => r,
    ForbiddenError,
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findUnique: (...a: unknown[]) => mocks.orgFindUnique(...a),
      update: (...a: unknown[]) => mocks.orgUpdate(...a),
    },
    user: { findUnique: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));

const scopeMod = await import("@/lib/tenancy/scope");
const { saveWhiteLabelSettings } = await import("@/lib/actions/white-label");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveWhiteLabelSettings admin gate", () => {
  it("a non-admin seat is rejected before any DB access", async () => {
    mocks.requireWorkspaceAdmin.mockRejectedValue(
      new scopeMod.ForbiddenError("Only an owner or admin can change this setting."),
    );
    const res = await saveWhiteLabelSettings(new FormData());
    expect(res).toMatchObject({ ok: false });
    expect(mocks.orgFindUnique).not.toHaveBeenCalled();
    expect(mocks.orgUpdate).not.toHaveBeenCalled();
  });
});
