import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// F-080 follow-up: content create and submit preserve the gate error's status,
// so a lapsed trial (TrialExpiredError, 402) isn't reported as 403.

const mocks = vi.hoisted(() => ({ requireWritableWorkspace: vi.fn() }));

vi.mock("@/lib/tenancy/scope", () => {
  class ForbiddenError extends Error {
    status = 403;
  }
  return {
    requireWritableWorkspace: () => mocks.requireWritableWorkspace(),
    requireScope: vi.fn(),
    tenantWhere: (s: { orgId: string }) => ({ orgId: s.orgId }),
    auditPayload: (_s: unknown, r: unknown) => r,
    ForbiddenError,
  };
});
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/email/draft-submitted", () => ({ sendDraftSubmittedEmail: vi.fn() }));

const scopeMod = await import("@/lib/tenancy/scope");
const create = await import("@/app/api/portal/content/route");
const submit = await import("@/app/api/portal/content/[id]/submit/route");

function trialExpired() {
  const err = new scopeMod.ForbiddenError("Your free trial has ended.");
  (err as unknown as { status: number }).status = 402;
  return err;
}

describe("content routes keep the trial gate's 402", () => {
  it("POST /api/portal/content", async () => {
    mocks.requireWritableWorkspace.mockRejectedValue(trialExpired());
    const res = await create.POST(
      new NextRequest("http://localhost/api/portal/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(402);
  });

  it("POST /api/portal/content/[id]/submit", async () => {
    mocks.requireWritableWorkspace.mockRejectedValue(trialExpired());
    const res = await submit.POST(
      new NextRequest("http://localhost/api/portal/content/d1/submit", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "d1" }) },
    );
    expect(res.status).toBe(402);
  });
});
