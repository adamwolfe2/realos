import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrgType, ProductLine } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  notificationFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findFirst: (...args: unknown[]) => mocks.findFirst(...args),
    },
    leadNotificationDelivery: {
      findMany: (...args: unknown[]) => mocks.notificationFindMany(...args),
    },
  },
}));

const { ClientActivationScopeError, loadClientActivation } = await import(
  "@/lib/admin/client-activation"
);

const NOW = new Date("2026-08-04T12:00:00.000Z");
const FRESH = new Date("2026-08-03T12:00:00.000Z");
const STALE = new Date("2026-07-01T12:00:00.000Z");

function property(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    orgId: "client-1",
    updatedAt: FRESH,
    backendPlatform: "NONE",
    lastSyncedAt: null,
    syncError: null,
    googlePlaceId: null,
    yelpBusinessId: null,
    notifyLeadEmailOverride: null,
    chatbotConfig: null,
    chatbotConversations: [],
    cursiveIntegrations: [],
    seoIntegrations: [],
    seoSnapshots: [],
    leads: [],
    popupCampaigns: [],
    reputationScans: [],
    seoActionRecs: [],
    websiteBuildRequests: [],
    ...overrides,
  };
}

function client(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    name: "Example Residential",
    orgType: OrgType.CLIENT,
    productLine: ProductLine.STUDENT_HOUSING,
    moduleAttribution: false,
    moduleChatbot: false,
    moduleConversations: false,
    modulePopups: false,
    moduleReputation: false,
    moduleSEO: false,
    moduleMarketIntelligence: false,
    moduleInsights: false,
    notifyLeadEmail: null,
    reportRecipients: [],
    properties: [],
    clientReports: [],
    leadNotificationDeliveries: [],
    ...overrides,
  };
}

function chatbotReadyProperty(id: string, observedAt = FRESH) {
  return property(id, {
    chatbotConfig: {
      orgId: "client-1",
      propertyId: id,
      chatbotEnabled: true,
      chatbotKnowledgeBase: "Verified leasing facts",
      updatedAt: observedAt,
    },
    chatbotConversations: [
      {
        orgId: "client-1",
        propertyId: id,
        leadId: `lead-${id}`,
        lastMessageAt: observedAt,
      },
    ],
  });
}

describe("loadClientActivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notificationFindMany.mockResolvedValue([]);
  });

  it("hides a missing or non-client target behind a null result", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(loadClientActivation("agency-1", NOW)).resolves.toBeNull();
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agency-1", orgType: OrgType.CLIENT },
      }),
    );
  });

  it("fails closed if Prisma returns a foreign organization", async () => {
    mocks.findFirst.mockResolvedValue(client({ id: "foreign-client" }));

    await expect(loadClientActivation("client-1", NOW)).rejects.toBeInstanceOf(
      ClientActivationScopeError,
    );
  });

  it("rejects a foreign-org property record instead of ignoring it", async () => {
    mocks.findFirst.mockResolvedValue(
      client({ properties: [property("property-1", { orgId: "foreign-client" })] }),
    );

    await expect(loadClientActivation("client-1", NOW)).rejects.toBeInstanceOf(
      ClientActivationScopeError,
    );
  });

  it("propagates database failures unchanged", async () => {
    const failure = new Error("database unavailable: private provider detail");
    mocks.findFirst.mockRejectedValue(failure);

    await expect(loadClientActivation("client-1", NOW)).rejects.toBe(failure);
  });

  it("uses two fixed Prisma calls for zero and fifty active properties", async () => {
    mocks.findFirst.mockResolvedValueOnce(client());
    await loadClientActivation("client-1", NOW);
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.notificationFindMany).toHaveBeenCalledTimes(1);

    mocks.findFirst.mockClear();
    mocks.notificationFindMany.mockClear();
    mocks.findFirst.mockResolvedValueOnce(
      client({
        properties: Array.from({ length: 50 }, (_, index) =>
          property(`property-${index + 1}`),
        ),
      }),
    );
    const result = await loadClientActivation("client-1", NOW);

    expect(result?.client.propertyCount).toBe(50);
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.notificationFindMany).toHaveBeenCalledTimes(1);
  });

  it("counts readiness only from exact-property chatbot evidence", async () => {
    mocks.notificationFindMany.mockResolvedValue([
      { propertyId: "property-1", leadId: "lead-property-1", sentAt: FRESH },
    ]);
    mocks.findFirst.mockResolvedValue(
      client({
        moduleChatbot: true,
        notifyLeadEmail: "leasing@example.test",
        properties: [chatbotReadyProperty("property-1"), property("property-2")],
        leadNotificationDeliveries: [
          {
            orgId: "client-1",
            propertyId: "property-1",
            leadId: "lead-property-1",
            status: "SENT",
            sentAt: FRESH,
          },
        ],
      }),
    );

    const result = await loadClientActivation("client-1", NOW);
    const chatbot = result?.rows.find(({ key }) => key === "ai-leasing-chatbot");

    expect(chatbot?.coverage).toEqual({
      ready: 0,
      total: 2,
      label: "0 of 2 properties ready",
    });
    expect(chatbot?.status).not.toBe("ready");
    expect(chatbot?.blockers).toContain(
      "Verify the property domain and chatbot origin.",
    );
    expect(chatbot?.blockers).toContain(
      "Verify property facts and availability in a controlled chat.",
    );
  });

  it("keeps module entitlement separate from activation readiness", async () => {
    mocks.findFirst.mockResolvedValue(
      client({
        moduleChatbot: true,
        properties: [property("property-1")],
      }),
    );

    const result = await loadClientActivation("client-1", NOW);
    const chatbot = result?.rows.find(({ key }) => key === "ai-leasing-chatbot");

    expect(chatbot?.access).toBe("enabled");
    expect(chatbot?.status).toBe("disconnected");
    expect(chatbot?.coverage.ready).toBe(0);
  });

  it("marks stale activation evidence as needing attention", async () => {
    mocks.notificationFindMany.mockResolvedValue([
      { propertyId: "property-1", leadId: "lead-property-1", sentAt: STALE },
    ]);
    mocks.findFirst.mockResolvedValue(
      client({
        moduleChatbot: true,
        notifyLeadEmail: "leasing@example.test",
        properties: [chatbotReadyProperty("property-1", STALE)],
        leadNotificationDeliveries: [
          {
            orgId: "client-1",
            propertyId: "property-1",
            leadId: "lead-property-1",
            status: "SENT",
            sentAt: STALE,
          },
        ],
      }),
    );

    const result = await loadClientActivation("client-1", NOW);
    const chatbot = result?.rows.find(({ key }) => key === "ai-leasing-chatbot");

    expect(chatbot?.status).toBe("needs_attention");
    expect(chatbot?.blockers).toContain(
      "Run the controlled chatbot lead and notification test.",
    );
  });

  it("does not hide a failing property behind another ready property", async () => {
    mocks.findFirst.mockResolvedValue(
      client({
        properties: [
          property("property-ready", {
            lastSyncedAt: FRESH,
            leads: [
              {
                orgId: "client-1",
                propertyId: "property-ready",
                visitorId: null,
                convertedAt: null,
                createdAt: FRESH,
              },
            ],
          }),
          property("property-stale", {
            lastSyncedAt: FRESH,
            syncError: "private provider failure",
            leads: [
              {
                orgId: "client-1",
                propertyId: "property-stale",
                visitorId: null,
                convertedAt: null,
                createdAt: FRESH,
              },
            ],
          }),
        ],
      }),
    );

    const result = await loadClientActivation("client-1", NOW);
    const foundation = result?.rows.find(
      ({ key }) => key === "connected-data-foundation",
    );

    expect(foundation?.coverage.ready).toBe(1);
    expect(foundation?.status).toBe("needs_attention");
  });

  it("does not accept a notification sent for a different chatbot lead", async () => {
    mocks.notificationFindMany.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue(
      client({
        moduleChatbot: true,
        notifyLeadEmail: "leasing@example.test",
        properties: [chatbotReadyProperty("property-1")],
      }),
    );

    const result = await loadClientActivation("client-1", NOW);
    const chatbot = result?.rows.find(({ key }) => key === "ai-leasing-chatbot");

    expect(chatbot?.status).toBe("disconnected");
    expect(mocks.notificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leadId: { in: ["lead-property-1"] },
        }),
      }),
    );
    expect(chatbot?.blockers).toContain(
      "Run the controlled chatbot lead and notification test.",
    );
  });

  it("surfaces a property sync error instead of treating fresh timestamps as ready", async () => {
    mocks.findFirst.mockResolvedValue(
      client({
        properties: [
          property("property-1", {
            lastSyncedAt: FRESH,
            syncError: "private provider failure",
            leads: [
              {
                orgId: "client-1",
                propertyId: "property-1",
                visitorId: null,
                convertedAt: null,
                createdAt: FRESH,
              },
            ],
          }),
        ],
      }),
    );

    const result = await loadClientActivation("client-1", NOW);
    const foundation = result?.rows.find(
      ({ key }) => key === "connected-data-foundation",
    );

    expect(foundation?.status).toBe("needs_attention");
    expect(JSON.stringify(foundation)).not.toContain("private provider failure");
  });

  it("preserves SEO and reputation error states in the safe profile", async () => {
    mocks.findFirst.mockResolvedValue(
      client({
        moduleSEO: true,
        moduleReputation: true,
        properties: [
          property("property-1", {
            googlePlaceId: "provider-place-id",
            seoIntegrations: [
              {
                orgId: "client-1",
                propertyId: "property-1",
                provider: "GSC",
                status: "ERROR",
                lastSyncAt: null,
                lastSyncError: "private SEO error",
                updatedAt: FRESH,
              },
            ],
            seoSnapshots: [
              { orgId: "client-1", propertyId: "property-1", date: FRESH },
            ],
            seoActionRecs: [
              {
                orgId: "client-1",
                propertyId: "property-1",
                generatedAt: FRESH,
              },
            ],
            reputationScans: [
              {
                orgId: "client-1",
                propertyId: "property-1",
                status: "PARTIAL",
                completedAt: FRESH,
              },
            ],
          }),
        ],
      }),
    );

    const result = await loadClientActivation("client-1", NOW);
    const search = result?.rows.find(
      ({ key }) => key === "search-opportunity-engine",
    );
    const reputation = result?.rows.find(
      ({ key }) => key === "reputation-rescue",
    );

    expect(search?.status).toBe("needs_attention");
    expect(reputation?.status).toBe("needs_attention");
    expect(JSON.stringify(result)).not.toContain("private SEO error");
    expect(JSON.stringify(result)).not.toContain("provider-place-id");
  });

  it("returns exactly the eight canonical products in registry order", async () => {
    mocks.findFirst.mockResolvedValue(client());

    const result = await loadClientActivation("client-1", NOW);

    expect(result?.rows.map(({ key }) => key)).toEqual([
      "connected-data-foundation",
      "lead-to-lease-attribution",
      "ai-leasing-chatbot",
      "conversion-offers",
      "reputation-rescue",
      "search-opportunity-engine",
      "monday-action-brief",
      "website-build",
    ]);
  });

  it("does not treat a generic client report as Monday Action Brief proof", async () => {
    mocks.findFirst.mockResolvedValue(
      client({
        moduleInsights: true,
        reportRecipients: ["private-person@example.test"],
        properties: [property("property-1", { lastSyncedAt: FRESH })],
        clientReports: [
          {
            orgId: "client-1",
            generatedAt: FRESH,
            sharedAt: FRESH,
            lastViewedAt: FRESH,
          },
        ],
      }),
    );

    const result = await loadClientActivation("client-1", NOW);
    const brief = result?.rows.find(({ key }) => key === "monday-action-brief");

    expect(brief?.status).not.toBe("ready");
    expect(brief?.blockers).toContain(
      "Generate and verify delivery of the weekly brief.",
    );
  });

  it("does not expose recipient addresses, provider errors, or evidence ids", async () => {
    mocks.findFirst.mockResolvedValue(
      client({
        notifyLeadEmail: "private-person@example.test",
        properties: [
          property("secret-property-id", {
            syncError: "raw provider stack trace",
          }),
        ],
      }),
    );

    const result = await loadClientActivation("client-1", NOW);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("private-person@example.test");
    expect(serialized).not.toContain("raw provider stack trace");
    expect(serialized).not.toContain("secret-property-id");
  });
});
