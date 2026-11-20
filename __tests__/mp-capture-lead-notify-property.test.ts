import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Popup + form lead notifications on a multi-property org. The Slack ping and
// the org primary-contact email said only the org name, so an operator could
// not tell whether the lead was for building A or B.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => Promise<void>>,
  org: null as unknown,
  popup: null as unknown,
  slack: vi.fn(async () => {}),
  tenantEmail: vi.fn(async () => ({ ok: true })),
  findOldestLeadByEmail: vi.fn(async () => null),
  lead: { create: vi.fn(), update: vi.fn() },
  property: { findFirst: vi.fn(), findMany: vi.fn(async () => []) },
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: vi.fn((cb: () => Promise<void>) => {
    h.afterCallbacks.push(cb);
  }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findUnique: vi.fn(async () => h.org) },
    popupCampaign: { findFirst: vi.fn(async () => h.popup) },
    property: h.property,
    lead: h.lead,
  },
}));
vi.mock("@/lib/leads/find-by-email", () => ({
  findOldestLeadByEmail: h.findOldestLeadByEmail,
}));
vi.mock("@/lib/rate-limit", () => ({
  publicSignupLimiter: {},
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  getIp: () => "1.2.3.4",
  WIDGET_FALLBACK: { publicSignup: {} },
}));
vi.mock("@/lib/tenancy/origin-guard", () => ({
  requireMatchingOrigin: vi.fn(async () => ({ ok: true, hostname: "x" })),
  chatbotOriginBypassEnabled: vi.fn(() => false),
}));
vi.mock("@/lib/notifications/lead-notify", () => ({ notifyLeadCaptured: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/create", () => ({ notifyLeadCreated: vi.fn(async () => {}) }));
vi.mock("@/lib/integrations/slack", () => ({ notifyNewIntake: h.slack }));
vi.mock("@/lib/email/lead-emails", () => ({ notifyTenantOfLeadEmail: h.tenantEmail }));
vi.mock("@/lib/popups/queries", () => ({ recordPopupEvent: vi.fn(async () => {}) }));

const popupRoute = await import("@/app/api/public/popup/lead/route");
const formRoute = await import("@/app/api/public/leads/route");

function post(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.afterCallbacks = [];
  h.org = {
    id: "org_1",
    orgType: "CLIENT",
    name: "SG Realty",
    modulePopups: true,
    primaryContactEmail: "owner@sg.test",
    tenantSiteConfig: null,
  };
  h.property.findFirst.mockImplementation(async ({ where }: { where: { id: string; orgId: string } }) =>
    where.id === "prop_b" && where.orgId === "org_1" ? { id: "prop_b", name: "Bravo Hall" } : null,
  );
  h.lead.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "lead_1",
    orgId: "org_1",
    firstName: null,
    lastName: null,
    email: "p@x.test",
    source: "FORM",
    propertyId: data.propertyId ?? null,
  }));
});

describe("popup lead notifications name the property", () => {
  it("puts the property name in the Slack ping and the primary-contact email", async () => {
    h.popup = { id: "pop_1", propertyId: "prop_b" };
    await popupRoute.POST(
      post("https://app.test/api/public/popup/lead", { tenantSlug: "sg", popupId: "pop_1", email: "p@x.test" }),
    );
    expect(h.slack.mock.calls[0][0].companyName).toBe("SG Realty · Bravo Hall");
    expect(h.tenantEmail.mock.calls[0][0].orgName).toBe("SG Realty · Bravo Hall");
  });

  it("keeps the bare org name for an org-level lead", async () => {
    h.popup = { id: "pop_1", propertyId: null };
    await popupRoute.POST(
      post("https://app.test/api/public/popup/lead", { tenantSlug: "sg", popupId: "pop_1", email: "p@x.test" }),
    );
    expect(h.slack.mock.calls[0][0].companyName).toBe("SG Realty");
    expect(h.tenantEmail.mock.calls[0][0].orgName).toBe("SG Realty");
  });
});

describe("form lead notifications name the property", () => {
  it("puts the property name in the Slack ping and the primary-contact email", async () => {
    await formRoute.POST(
      post("https://app.test/api/public/leads", {
        orgId: "org_1",
        propertyId: "prop_b",
        source: "FORM",
        email: "p@x.test",
      }),
    );
    for (const cb of h.afterCallbacks) await cb();
    expect(h.slack.mock.calls[0][0].companyName).toBe("SG Realty · Bravo Hall");
    expect(h.tenantEmail.mock.calls[0][0].orgName).toBe("SG Realty · Bravo Hall");
  });
});
