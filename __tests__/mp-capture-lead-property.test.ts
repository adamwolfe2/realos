import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Multi-property lead capture. One org, two ACTIVE properties each on its own
// website:
//   - popup lead from an org-wide campaign (propertyId null) whose embed has
//     no data-property must still land on the building whose site it fired on;
//   - pre-chat lead for an email we already hold with no property must pick
//     up the resolved property (fill only, never overwrite), matching the
//     mid-chat, popup and form capture paths.
// ---------------------------------------------------------------------------

const PROPERTIES = [
  { id: "prop_a", slug: "alpha", name: "Alpha House", websiteUrl: "https://alpha-living.test" },
  { id: "prop_b", slug: "bravo", name: "Bravo Hall", websiteUrl: "https://bravo-hall.test" },
];

const h = vi.hoisted(() => ({
  org: null as unknown,
  popup: null as unknown,
  findOldestLeadByEmail: vi.fn(),
  lead: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  property: { findFirst: vi.fn(), findMany: vi.fn() },
  chatbotConversation: { create: vi.fn() },
  notifyLeadCaptured: vi.fn(async () => {}),
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findUnique: vi.fn(async () => h.org) },
    popupCampaign: { findFirst: vi.fn(async () => h.popup) },
    property: h.property,
    lead: h.lead,
    chatbotConversation: h.chatbotConversation,
  },
}));
vi.mock("@/lib/leads/find-by-email", () => ({
  findOldestLeadByEmail: h.findOldestLeadByEmail,
}));
vi.mock("@/lib/rate-limit", () => ({
  publicSignupLimiter: {},
  chatbotLeadLimiter: {},
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  getIp: () => "1.2.3.4",
  WIDGET_FALLBACK: { publicSignup: {} },
}));
vi.mock("@/lib/tenancy/origin-guard", () => ({
  requireMatchingOrigin: vi.fn(async () => ({ ok: true, hostname: "x" })),
  chatbotOriginBypassEnabled: vi.fn(() => false),
}));
vi.mock("@/lib/notifications/lead-notify", () => ({
  notifyLeadCaptured: h.notifyLeadCaptured,
}));
vi.mock("@/lib/notifications/create", () => ({
  notifyLeadCreated: vi.fn(async () => {}),
  notifyChatbotLeadCaptured: vi.fn(async () => {}),
}));
vi.mock("@/lib/integrations/slack", () => ({
  notifyNewIntake: vi.fn(async () => {}),
}));
vi.mock("@/lib/email/lead-emails", () => ({
  notifyTenantOfLeadEmail: vi.fn(async () => {}),
}));
vi.mock("@/lib/popups/queries", () => ({
  recordPopupEvent: vi.fn(async () => {}),
}));
vi.mock("@/lib/chatbot/resolve-config", () => ({
  resolveChatbotConfig: vi.fn(async () => ({ chatbotEnabled: true })),
}));

const popupRoute = await import("@/app/api/public/popup/lead/route");
const preChatRoute = await import("@/app/api/public/chatbot/lead/route");

function post(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.property.findMany.mockResolvedValue(PROPERTIES);
  h.property.findFirst.mockResolvedValue(null);
  h.findOldestLeadByEmail.mockResolvedValue(null);
  h.lead.create.mockResolvedValue({ id: "lead_new", orgId: "org_1", firstName: null, lastName: null, email: "p@x.test", source: "FORM" });
  h.lead.update.mockResolvedValue({ id: "lead_old" });
  h.chatbotConversation.create.mockResolvedValue({ id: "conv_1" });
});

describe("popup lead on a multi-property org", () => {
  beforeEach(() => {
    h.org = { id: "org_1", orgType: "CLIENT", name: "SG", modulePopups: true, primaryContactEmail: null };
    h.popup = { id: "pop_1", propertyId: null };
  });

  it("stamps the property whose website the org-wide popup fired on", async () => {
    const res = await popupRoute.POST(
      post("https://app.test/api/public/popup/lead", {
        tenantSlug: "sg",
        popupId: "pop_1",
        email: "p@x.test",
        pageUrl: "https://bravo-hall.test/floor-plans",
      }),
    );
    expect(res.status).toBe(201);
    expect(h.lead.create.mock.calls[0][0].data.propertyId).toBe("prop_b");
    expect(h.property.findMany.mock.calls[0][0].where).toEqual({ orgId: "org_1" });
  });

  it("stays org-level when the page cannot be tied to one property", async () => {
    await popupRoute.POST(
      post("https://app.test/api/public/popup/lead", {
        tenantSlug: "sg",
        popupId: "pop_1",
        email: "p@x.test",
        pageUrl: "https://portfolio.test/",
      }),
    );
    expect(h.lead.create.mock.calls[0][0].data.propertyId).toBeNull();
  });

  it("keeps the campaign's own property over page inference", async () => {
    h.popup = { id: "pop_1", propertyId: "prop_a" };
    await popupRoute.POST(
      post("https://app.test/api/public/popup/lead", {
        tenantSlug: "sg",
        popupId: "pop_1",
        email: "p@x.test",
        pageUrl: "https://bravo-hall.test/",
      }),
    );
    expect(h.lead.create.mock.calls[0][0].data.propertyId).toBe("prop_a");
    expect(h.property.findMany).not.toHaveBeenCalled();
  });
});

describe("pre-chat lead for an existing email on a multi-property org", () => {
  beforeEach(() => {
    h.org = { id: "org_1", orgType: "CLIENT", moduleChatbot: true, properties: PROPERTIES };
  });

  const body = { slug: "sg", firstName: "Pat", email: "p@x.test", property: "bravo" };

  it("fills a missing propertyId on the existing lead", async () => {
    h.findOldestLeadByEmail.mockResolvedValue({ id: "lead_old", phone: null, propertyId: null, trafficSource: null, createdAt: new Date() });
    const res = await preChatRoute.POST(post("https://app.test/api/public/chatbot/lead", body));
    expect(res.status).toBe(201);
    expect(h.lead.update.mock.calls[0][0].data.propertyId).toBe("prop_b");
  });

  it("never overwrites the property the lead already has", async () => {
    h.findOldestLeadByEmail.mockResolvedValue({ id: "lead_old", phone: null, propertyId: "prop_a", trafficSource: null, createdAt: new Date() });
    await preChatRoute.POST(post("https://app.test/api/public/chatbot/lead", body));
    expect(h.lead.update.mock.calls[0][0].data.propertyId).toBe("prop_a");
    // The conversation itself still records the building it happened on.
    expect(h.chatbotConversation.create.mock.calls[0][0].data.propertyId).toBe("prop_b");
  });
});
