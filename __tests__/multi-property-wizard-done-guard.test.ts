import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Multi-property: once onboarding is "done", a stale wizard tab or replayed
// POST to the property steps must not touch the live portfolio. Before:
// /wizard/property renamed the org's OLDEST property (property A) to the
// posted name and reset onboardingStep to "plan"; /wizard/properties
// overwrote matched properties' address fields and minted new ACTIVE
// properties without the billing sync / scaffolding that createProperty runs.
// After: both are no-op success with nextStep "done".
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ userId: "clerk_1" })),
  user: { findUnique: vi.fn() },
  property: {
    findFirst: vi.fn(),
    findMany: vi.fn(async () => []),
    create: vi.fn(),
    update: vi.fn(),
  },
  organization: { update: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
  auditEvent: { create: vi.fn(async () => ({})) },
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: () => h.auth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: h.user,
    property: h.property,
    organization: h.organization,
    auditEvent: h.auditEvent,
  },
}));
vi.mock("@/lib/analytics-server", () => ({ trackServer: vi.fn() }));
vi.mock("@/lib/notifications/funnel-alert", () => ({ alertFunnelStep: vi.fn() }));
vi.mock("@/lib/onboarding/scaffold", () => ({
  scaffoldPropertyIntegrations: vi.fn(async () => undefined),
}));

const { POST: propertyPOST } = await import(
  "@/app/api/onboarding/wizard/property/route"
);
const { POST: propertiesPOST } = await import(
  "@/app/api/onboarding/wizard/properties/route"
);

const req = (body: unknown) => ({ json: async () => body }) as never;

const doneUser = {
  role: "CLIENT_OWNER",
  id: "u1",
  orgId: "org-1",
  org: {
    onboardingStep: "done",
    propertyType: "RESIDENTIAL",
    residentialSubtype: null,
    commercialSubtype: null,
    trialStartedAt: new Date(),
    trialEndsAt: new Date(),
    subscriptionStatus: "ACTIVE",
    moduleChatbot: true,
  },
};

beforeEach(() => {
  for (const m of [h.property, h.organization]) {
    for (const fn of Object.values(m)) fn.mockClear();
  }
  h.user.findUnique.mockReset().mockResolvedValue(doneUser);
  h.property.findFirst.mockResolvedValue({ id: "prop-a", slug: "building-a" });
});

describe("wizard property steps on a completed workspace", () => {
  it("/wizard/property does not rename property A or regress the step", async () => {
    const res = await propertyPOST(req({ name: "Building C" }));
    expect(await res.json()).toEqual({ ok: true, nextStep: "done" });
    expect(h.property.update).not.toHaveBeenCalled();
    expect(h.property.create).not.toHaveBeenCalled();
    expect(h.organization.update).not.toHaveBeenCalled();
  });

  it("/wizard/properties does not create or overwrite properties", async () => {
    const res = await propertiesPOST(
      req({ properties: [{ name: "Building A" }, { name: "Building C" }] }),
    );
    expect(await res.json()).toEqual({ ok: true, nextStep: "done" });
    expect(h.property.create).not.toHaveBeenCalled();
    expect(h.property.update).not.toHaveBeenCalled();
    expect(h.organization.updateMany).not.toHaveBeenCalled();
  });

  it("an in-progress wizard still creates its property", async () => {
    h.user.findUnique.mockResolvedValue({
      ...doneUser,
      org: { ...doneUser.org, onboardingStep: "property" },
    });
    h.property.findFirst.mockResolvedValue(null);
    const res = await propertyPOST(req({ name: "Building A" }));
    expect((await res.json()).nextStep).toBe("plan");
    expect(h.property.create).toHaveBeenCalledTimes(1);
  });
});
