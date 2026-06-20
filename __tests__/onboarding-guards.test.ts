import { describe, it, expect, vi, beforeEach } from "vitest";
import { previousStep } from "@/lib/onboarding/steps";

// ---------------------------------------------------------------------------
// Regression for P1-3 / P1-4: onboarding wizard "back" and "features" routes
// must never regress or downgrade a completed/paid workspace via a stale tab
// or replayed POST.
// ---------------------------------------------------------------------------

describe("previousStep terminal guard (P1-3)", () => {
  it("never walks a completed (done) org backward", () => {
    expect(previousStep("done")).toBe("done");
  });
  it("still decrements the live wizard steps", () => {
    expect(previousStep("properties")).toBe("features");
    expect(previousStep("features")).toBe("welcome");
    expect(previousStep("welcome")).toBe("welcome");
  });
});

const h = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ userId: "clerk_1" })),
  user: { findUnique: vi.fn() },
  org: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: () => h.auth() }));
vi.mock("@/lib/db", () => ({
  prisma: { user: h.user, organization: h.org },
}));

const { POST: backPOST } = await import("@/app/api/onboarding/wizard/back/route");
const { POST: featuresPOST } = await import(
  "@/app/api/onboarding/wizard/features/route"
);

const req = (body?: unknown) =>
  ({ json: async () => body ?? {} }) as unknown as Request;

// vi.fn() types .mock.calls as empty tuples; read a recorded arg as `any`.
const callArg = (fn: any, call = 0, arg = 0): any => fn.mock.calls[call][arg];

beforeEach(() => {
  h.auth.mockReset().mockResolvedValue({ userId: "clerk_1" });
  h.user.findUnique.mockReset();
  h.org.update.mockReset().mockResolvedValue({});
  h.org.updateMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("onboarding back route (P1-3)", () => {
  it("uses an atomic NOT-done guard and reports done when the org is terminal", async () => {
    h.user.findUnique.mockResolvedValue({
      org: { id: "org_1", onboardingStep: "properties" },
    });
    h.org.updateMany.mockResolvedValue({ count: 0 }); // org concurrently done
    const res = await backPOST(req() as never);
    const json = await res.json();
    expect(json.currentStep).toBe("done");
    const where = callArg(h.org.updateMany).where;
    expect(where).toMatchObject({ id: "org_1", NOT: { onboardingStep: "done" } });
  });

  it("walks a mid-wizard org back one step", async () => {
    h.user.findUnique.mockResolvedValue({
      org: { id: "org_1", onboardingStep: "properties" },
    });
    h.org.updateMany.mockResolvedValue({ count: 1 });
    const res = await backPOST(req() as never);
    expect((await res.json()).currentStep).toBe("features");
  });

  it("is a no-op for a done org without writing", async () => {
    h.user.findUnique.mockResolvedValue({
      org: { id: "org_1", onboardingStep: "done" },
    });
    const res = await backPOST(req() as never);
    expect((await res.json()).currentStep).toBe("done");
    expect(h.org.updateMany).not.toHaveBeenCalled();
  });
});

describe("onboarding features route (P1-4)", () => {
  it("gates the entitlement write on a non-paid subscription status", async () => {
    h.user.findUnique.mockResolvedValue({ id: "u_1", orgId: "org_1" });
    await featuresPOST(req({ selectedModules: [] }) as never);
    // First updateMany call = the entitlement write; must carry the status guard.
    const where = callArg(h.org.updateMany).where;
    expect(where.id).toBe("org_1");
    expect(where.OR).toEqual([
      { subscriptionStatus: null },
      { subscriptionStatus: { notIn: ["ACTIVE", "PAST_DUE"] } },
    ]);
    // Never uses the unconditional update().
    expect(h.org.update).not.toHaveBeenCalled();
  });
});
